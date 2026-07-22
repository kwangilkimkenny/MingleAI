import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { currentPair, snapshotFor, type SpeedDateState } from "./speed-date.state";
import { SpeedDateSessionService } from "./speed-date-session.service";
import { SpeedDateConfigProvider } from "./speed-date.config";
import { LivekitTokenService } from "./livekit-token.service";
import { socketCorsOrigin } from "../common/socket-cors";
import { AccountAccessService } from "../auth/account-access.service";

@WebSocketGateway({ cors: { origin: socketCorsOrigin() }, maxHttpBufferSize: 16 * 1024 })
export class SpeedDateGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer() server!: Server;

  /** sessionId → (socketId → profileId). Ephemeral, single-instance-only. */
  private readonly presence = new Map<string, Map<string, string>>();
  private sweepTimer?: ReturnType<typeof setInterval>;
  private sweeping = false;

  constructor(
    private readonly jwt: JwtService,
    private readonly sessions: SpeedDateSessionService,
    private readonly configProvider: SpeedDateConfigProvider,
    private readonly token: LivekitTokenService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => void this.runSweep(), this.configProvider.value.sweepMs);
  }

  onModuleDestroy(): void {
    if (this.sweepTimer !== undefined) clearInterval(this.sweepTimer);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) return void client.disconnect();
      const payload = this.jwt.verify(token) as { sub: string };
      const account = await this.accountAccess.findActive(payload.sub);
      if (!account) return void client.disconnect();
      client.data.userId = account.userId;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    for (const [sessionId, members] of this.presence) {
      if (members.delete(client.id) && members.size === 0) this.presence.delete(sessionId);
    }
  }

  @SubscribeMessage("speeddate:join")
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId?: string },
  ): Promise<void> {
    const profileId = await this.authorize(client, body?.sessionId);
    if (!profileId || !body?.sessionId) return;
    const members = this.presence.get(body.sessionId) ?? new Map<string, string>();
    members.set(client.id, profileId);
    this.presence.set(body.sessionId, members);
    await this.sendSnapshot(client, body.sessionId, profileId);
  }

  @SubscribeMessage("speeddate:sync")
  async handleSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId?: string },
  ): Promise<void> {
    const profileId = await this.authorize(client, body?.sessionId);
    if (!profileId || !body?.sessionId) return;
    await this.sendSnapshot(client, body.sessionId, profileId);
  }

  @SubscribeMessage("speeddate:choose")
  async handleChoose(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId?: string; targetProfileId?: string; on?: boolean },
  ): Promise<void> {
    const profileId = await this.authorize(client, body?.sessionId);
    if (!profileId || !body?.sessionId || !body?.targetProfileId) return;
    const state = await this.sessions.choose(
      body.sessionId,
      profileId,
      body.targetProfileId,
      body.on !== false,
    );
    if (!state) {
      client.emit("speeddate:error", { message: "선택할 수 없습니다" });
      return;
    }
    // choices are private — echo only to the chooser.
    await this.sendSnapshot(client, body.sessionId, profileId);
  }

  @SubscribeMessage("speeddate:leave")
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { sessionId?: string }): void {
    if (!body?.sessionId) return;
    const members = this.presence.get(body.sessionId);
    if (members?.delete(client.id) && members.size === 0) this.presence.delete(body.sessionId);
  }

  private async runSweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const outcomes = await this.sessions.advanceAllActive(new Date());
      for (const o of outcomes) {
        if (o.transitioned) await this.broadcast(o.sessionId, o.state);
      }
    } catch {
      // best-effort; next tick retries
    } finally {
      this.sweeping = false;
    }
  }

  /** Re-project and emit a fresh snapshot to every connected socket of a session. */
  private async broadcast(sessionId: string, state: SpeedDateState): Promise<void> {
    const members = this.presence.get(sessionId);
    if (!members) return;
    for (const [socketId, profileId] of members) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) await this.emitSnapshot(socket, sessionId, profileId, state);
    }
  }

  private async sendSnapshot(client: Socket, sessionId: string, profileId: string): Promise<void> {
    const state = await this.sessions.loadState(sessionId);
    if (!state) {
      client.emit("speeddate:snapshot", { sessionId, snapshot: null });
      return;
    }
    await this.emitSnapshot(client, sessionId, profileId, state);
  }

  /** Build the per-viewer snapshot and augment it with a room-scoped LiveKit token when in a round. */
  private async emitSnapshot(
    client: Socket,
    sessionId: string,
    profileId: string,
    state: SpeedDateState,
  ): Promise<void> {
    const snapshot = snapshotFor(sessionId, state, profileId);
    const cp = currentPair(state, profileId);
    if (cp && snapshot.phase === "round") {
      const room = LivekitTokenService.roomName(sessionId, state.stageIndex, state.roundIndex, cp.pairIndex);
      const access = await this.token.mint(profileId, room, {
        canPublishVideo: cp.publishVideo,
        ttlMs: this.configProvider.value.roundMs + 60_000,
      });
      snapshot.room = { room, url: access.url, token: access.token, publishVideo: cp.publishVideo };
    }
    client.emit("speeddate:snapshot", { sessionId, snapshot });
  }

  private async authorize(client: Socket, sessionId?: string): Promise<string | null> {
    if (!client.data.userId || !sessionId) {
      client.emit("speeddate:error", { message: "forbidden" });
      return null;
    }
    if (!this.allowSocketEvent(client, "action", 30, 10_000)) {
      client.emit("speeddate:error", { message: "rate-limited" });
      return null;
    }
    if (!(await this.accountAccess.findActive(client.data.userId))) {
      client.disconnect();
      return null;
    }
    const profileId = await this.sessions.assertParticipant(client.data.userId, sessionId);
    if (!profileId) {
      client.emit("speeddate:error", { message: "forbidden" });
      return null;
    }
    return profileId;
  }

  private allowSocketEvent(client: Socket, key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const buckets = (client.data.rateBuckets ??= {}) as Record<
      string,
      { startedAt: number; count: number }
    >;
    const bucket = buckets[key];
    if (!bucket || now - bucket.startedAt >= windowMs) {
      buckets[key] = { startedAt: now, count: 1 };
      return true;
    }
    bucket.count += 1;
    return bucket.count <= limit;
  }
}
