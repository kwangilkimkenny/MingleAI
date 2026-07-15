import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import type { GameChoice } from "@mingle/shared";
import { PartyService } from "./party.service";
import { GameService } from "./game.service";
import { AmongService, AmongState } from "./among.service";
import { AmongConfigProvider } from "./among.config";
import { socketCorsOrigin } from "../common/socket-cors";

@WebSocketGateway({ cors: { origin: socketCorsOrigin() } })
export class PartyGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer() server!: Server;

  /** partyId → (socketId → profileId). Presence is ephemeral by design. */
  private readonly presence = new Map<string, Map<string, string>>();

  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly jwt: JwtService,
    private readonly party: PartyService,
    private readonly game: GameService,
    private readonly among: AmongService,
    private readonly amongConfig: AmongConfigProvider,
  ) {}

  onModuleInit() {
    this.sweepTimer = setInterval(() => {
      void this.runAmongSweep();
    }, this.amongConfig.value.sweepMs);
  }

  onModuleDestroy() {
    if (this.sweepTimer !== undefined) {
      clearInterval(this.sweepTimer);
    }
  }

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) return client.disconnect();
      const payload = this.jwt.verify(token) as { sub: string };
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    for (const [partyId, members] of this.presence) {
      if (members.delete(client.id)) {
        if (members.size === 0) this.presence.delete(partyId);
        this.broadcastPresence(partyId);
      }
    }
  }

  @SubscribeMessage("party:join")
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { partyId: string }) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    await client.join(body.partyId);
    let members = this.presence.get(body.partyId);
    if (!members) {
      members = new Map();
      this.presence.set(body.partyId, members);
    }
    members.set(client.id, me);
    this.broadcastPresence(body.partyId);
    await this.maybeAutoStartAmong(body.partyId);
  }

  @SubscribeMessage("party:leave")
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { partyId: string }) {
    // Authenticated sockets only (handshake already enforces this); leave is self-service —
    // it only removes THIS socket's presence entry, so no participation check is needed.
    if (!client.data.userId || !body?.partyId) return;
    void client.leave(body.partyId);
    const members = this.presence.get(body.partyId);
    if (members?.delete(client.id)) {
      if (members.size === 0) this.presence.delete(body.partyId);
      this.broadcastPresence(body.partyId);
    }
  }

  @SubscribeMessage("party:chat")
  async handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string; content: string },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const message = await this.party.addPartyMessage(me, body.partyId, body.content);
      this.server.to(body.partyId).emit("party:message", message);
    } catch {
      client.emit("party:error", { message: "invalid" });
    }
  }

  @SubscribeMessage("party:move")
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string; x: number; y: number },
  ) {
    // Membership was proven at party:join — the presence map is the (cheap) authority here.
    const me = this.presence.get(body?.partyId)?.get(client.id);
    if (!me || typeof body.x !== "number" || typeof body.y !== "number") return;
    client.to(body.partyId).emit("party:moved", { profileId: me, x: body.x, y: body.y });
  }

  @SubscribeMessage("game:start")
  async handleGameStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const snapshot = await this.game.start(body.partyId);
      this.server.to(body.partyId).emit("game:state", { partyId: body.partyId, snapshot });
    } catch (e) {
      client.emit("party:error", { message: this.gameErrorMessage(e) });
    }
  }

  @SubscribeMessage("game:vote")
  async handleGameVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string; choice: GameChoice },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const roster = [...new Set(this.presence.get(body.partyId)?.values() ?? [])];
      const snapshot = await this.game.vote(body.partyId, me, body.choice, roster);
      this.server.to(body.partyId).emit("game:state", { partyId: body.partyId, snapshot });
    } catch (e) {
      client.emit("party:error", { message: this.gameErrorMessage(e) });
    }
  }

  @SubscribeMessage("game:sync")
  async handleGameSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    const snapshot = await this.game.current(body.partyId);
    client.emit("game:state", { partyId: body.partyId, snapshot });
  }

  @SubscribeMessage("game:end")
  async handleGameEnd(@ConnectedSocket() client: Socket, @MessageBody() body: { partyId: string }) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const snapshot = await this.game.end(body.partyId);
      this.server.to(body.partyId).emit("game:state", { partyId: body.partyId, snapshot });
    } catch (e) {
      client.emit("party:error", { message: this.gameErrorMessage(e) });
    }
  }

  private gameErrorMessage(e: unknown): string {
    if (e instanceof ConflictException) return "already-active";
    if (e instanceof NotFoundException) return "no-active-game";
    if (e instanceof BadRequestException) {
      // Preserve the specific "not-enough-players" message; all others → "invalid".
      const msg =
        typeof (e as { message?: unknown }).message === "string"
          ? (e as { message: string }).message
          : "";
      if (msg === "not-enough-players") return "not-enough-players";
      return "invalid";
    }
    return "invalid";
  }

  private broadcastAmong(partyId: string, state: AmongState): void {
    for (const [socketId, viewerId] of this.presence.get(partyId) ?? []) {
      this.server.to(socketId).emit("among:state", {
        partyId,
        snapshot: this.among.project(state, viewerId),
      });
    }
  }

  /**
   * Auto-starts Among Us the moment the party fills to capacity — no manual "start" button.
   * Fires at the end of `party:join`. Guarded so it only ever fires the party's FIRST game:
   * a party that already has an ended session must use the existing manual 다시하기 path
   * (`among:start`) instead of silently re-starting.
   *
   * Non-fatal by design: any failure here (including the expected Conflict race when two
   * sockets join concurrently and both observe a full roster) is logged and swallowed — the
   * per-party advisory lock + partial unique index in AmongService.start is the real defense
   * against a double-start, this is just an optimization to avoid attempting it needlessly.
   */
  private async maybeAutoStartAmong(partyId: string): Promise<void> {
    try {
      const roster = [...new Set(this.presence.get(partyId)?.values() ?? [])];
      if (roster.length < this.amongConfig.value.minPlayers) return;

      const party = await this.party.findOne(partyId);
      if (roster.length !== party.participantCount) return;

      const everExisted = await this.among.latestAmong(partyId);
      if (everExisted) return;

      const state = await this.among.start(
        partyId,
        roster.map((profileId) => ({ profileId, isBot: false })),
      );
      this.broadcastAmong(partyId, state);
    } catch (e) {
      console.warn(`[party.gateway] among auto-start failed for party ${partyId}:`, e);
    }
  }

  private async runAmongSweep(): Promise<void> {
    try {
      for (const pid of await this.among.sweepMeetings()) {
        const st = (await this.among.current(pid)) ?? (await this.among.latestAmong(pid));
        if (st) this.broadcastAmong(pid, st);
      }
    } catch {
      // non-fatal
    }
  }

  @SubscribeMessage("among:start")
  async handleAmongStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    const roster = [...new Set(this.presence.get(body.partyId)?.values() ?? [])].map(
      (profileId) => ({ profileId, isBot: false }),
    );
    try {
      const s = await this.among.start(body.partyId, roster);
      this.broadcastAmong(body.partyId, s);
    } catch (e) {
      client.emit("party:error", { message: this.gameErrorMessage(e) });
    }
  }

  @SubscribeMessage("among:task")
  async handleAmongTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string; taskId: string; x: number; y: number },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const s = await this.among.doTask(body.partyId, me, body.taskId);
      this.broadcastAmong(body.partyId, s);
    } catch (e) {
      client.emit("party:error", { message: this.gameErrorMessage(e) });
    }
  }

  @SubscribeMessage("among:kill")
  async handleAmongKill(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string; targetProfileId: string; x: number; y: number },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const s = await this.among.kill(body.partyId, me, body.targetProfileId, body.x, body.y);
      this.broadcastAmong(body.partyId, s);
    } catch (e) {
      client.emit("party:error", { message: this.gameErrorMessage(e) });
    }
  }

  @SubscribeMessage("among:report")
  async handleAmongReport(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string; bodyProfileId: string },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const s = await this.among.report(body.partyId, me, body.bodyProfileId);
      this.broadcastAmong(body.partyId, s);
    } catch (e) {
      client.emit("party:error", { message: this.gameErrorMessage(e) });
    }
  }

  @SubscribeMessage("among:emergency")
  async handleAmongEmergency(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const s = await this.among.emergency(body.partyId, me);
      this.broadcastAmong(body.partyId, s);
    } catch (e) {
      client.emit("party:error", { message: this.gameErrorMessage(e) });
    }
  }

  @SubscribeMessage("among:vote")
  async handleAmongVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string; targetProfileId: string },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const s = await this.among.vote(body.partyId, me, body.targetProfileId);
      this.broadcastAmong(body.partyId, s);
    } catch (e) {
      client.emit("party:error", { message: this.gameErrorMessage(e) });
    }
  }

  @SubscribeMessage("among:sync")
  async handleAmongSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    const state =
      (await this.among.current(body.partyId)) ?? (await this.among.latestAmong(body.partyId));
    client.emit("among:state", {
      partyId: body.partyId,
      snapshot: this.among.project(state, me),
    });
  }

  @SubscribeMessage("among:end")
  async handleAmongEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const s = await this.among.end(body.partyId);
      this.broadcastAmong(body.partyId, s);
    } catch (e) {
      client.emit("party:error", { message: this.gameErrorMessage(e) });
    }
  }

  private async authorize(client: Socket, partyId?: string): Promise<string | null> {
    if (!client.data.userId || !partyId) {
      client.emit("party:error", { message: "forbidden" });
      return null;
    }
    const me = await this.party.assertParticipant(client.data.userId, partyId);
    if (!me) {
      client.emit("party:error", { message: "forbidden" });
      return null;
    }
    return me;
  }

  private broadcastPresence(partyId: string) {
    const members = [...new Set(this.presence.get(partyId)?.values() ?? [])];
    this.server.to(partyId).emit("party:presence", { partyId, members });
  }
}
