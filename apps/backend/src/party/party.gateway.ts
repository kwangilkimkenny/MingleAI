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
import { ConfigService } from "@nestjs/config";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { GameChoice } from "@mingle/shared";
import { PartyService } from "./party.service";
import { GameService } from "./game.service";
import { AmongService, AmongState } from "./among.service";
import { AmongConfigProvider } from "./among.config";
import { AiChatClient, createAiChatClient } from "./ai/ai-chat.client";
import { fallbackLine } from "./ai/personas";
import { socketCorsOrigin } from "../common/socket-cors";

@WebSocketGateway({ cors: { origin: socketCorsOrigin() } })
export class PartyGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer() server!: Server;

  /** partyId → (socketId → profileId). Presence is ephemeral by design. */
  private readonly presence = new Map<string, Map<string, string>>();

  /**
   * partyId → (profileId → last known world position), refreshed on every `party:move`.
   * Feeds the AI bot sweep's kill/witness checks. In-memory, single-instance-only —
   * same lifetime assumption as `presence`.
   */
  private readonly humanPos = new Map<string, Map<string, { x: number; y: number }>>();

  /**
   * partyId → recent chat lines (cap 30), pushed on every successful `party:chat`.
   * Feeds the AI chat client's `recentChat` context for say/pickVote. In-memory,
   * single-instance-only.
   */
  private readonly chatBuf = new Map<string, string[]>();

  private readonly aiChat: AiChatClient;

  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly jwt: JwtService,
    private readonly party: PartyService,
    private readonly game: GameService,
    private readonly among: AmongService,
    private readonly amongConfig: AmongConfigProvider,
    configService: ConfigService,
  ) {
    this.aiChat = createAiChatClient(configService);
  }

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
      const me = members.get(client.id);
      if (members.delete(client.id)) {
        if (members.size === 0) this.presence.delete(partyId);
        this.broadcastPresence(partyId);
      }
      this.clearHumanPos(partyId, me);
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
    const me = members?.get(client.id);
    if (members?.delete(client.id)) {
      if (members.size === 0) this.presence.delete(body.partyId);
      this.broadcastPresence(body.partyId);
    }
    this.clearHumanPos(body.partyId, me);
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
      // Ring buffer for the AI chat client's `recentChat` context. Keying it to an among
      // player name would need a state lookup per chat message — not worth the cost, the
      // raw content alone gives the LLM enough context (simplification, noted per brief).
      const buf = this.chatBuf.get(body.partyId) ?? [];
      buf.push(String(message.content).slice(0, 200));
      if (buf.length > 30) buf.shift();
      this.chatBuf.set(body.partyId, buf);
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
    let posMap = this.humanPos.get(body.partyId);
    if (!posMap) {
      posMap = new Map();
      this.humanPos.set(body.partyId, posMap);
    }
    // Stored as-is (no clamping) — the AI brain does its own world-metric distance checks.
    posMap.set(me, { x: body.x, y: body.y });
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
      // Natural end (final round's last vote): the party may have filled up WHILE the balance
      // game was running, in which case the 4th join's auto-start attempt hit a Conflict (one
      // active session per party) and was swallowed — see maybeAutoStartAmong. Retry now that
      // the balance session is out of the way.
      if (snapshot.status === "ended") {
        await this.maybeAutoStartAmong(body.partyId);
      }
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
      // Same pre-emption rescue as the vote-induced natural end above: retry the Among Us
      // auto-start now that the balance session has ended.
      await this.maybeAutoStartAmong(body.partyId);
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
      if (msg === "ai-unavailable") return "AI 게임 준비 중이에요";
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

  /** Re-fetches the latest state (active, or ended-fallback) and re-broadcasts it. */
  private async rebroadcastAmong(partyId: string): Promise<void> {
    const st = (await this.among.current(partyId)) ?? (await this.among.latestAmong(partyId));
    if (st) this.broadcastAmong(partyId, st);
  }

  /** Removes a profile's cached position for a party (join-time membership already gone). */
  private clearHumanPos(partyId: string, profileId: string | undefined): void {
    if (!profileId) return;
    const pos = this.humanPos.get(partyId);
    if (pos?.delete(profileId) && pos.size === 0) this.humanPos.delete(partyId);
  }

  /**
   * Auto-starts Among Us the moment the party fills to capacity — no manual "start" button.
   * Fires at the end of `party:join`, and is retried when a balance (`game:*`) session ends
   * (both the explicit `game:end` handler and the vote-induced natural end) to rescue the
   * pre-emption case: a balance game started before the roster filled up, so the 4th join's
   * auto-start attempt raced into a Conflict (one active session per party) and was swallowed —
   * without this retry Among Us would never start for that party. Guarded so it only ever fires
   * the party's FIRST game: a party that already has an (active or ended) session must use the
   * existing manual 다시하기 path (`among:start`) instead of silently re-starting.
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

      // Cheap bail first: most calls land on a party whose Among session already ran (or is
      // running) — check that before paying for the party.findOne round-trip.
      const everExisted = await this.among.latestAmong(partyId);
      if (everExisted) return;

      const party = await this.party.findOne(partyId);
      if (roster.length !== party.participantCount) return;

      const state = await this.among.start(
        partyId,
        roster.map((profileId) => ({ profileId, isBot: false })),
        { llmEnabled: this.aiChat.enabled },
      );
      this.broadcastAmong(partyId, state);
    } catch (e) {
      console.warn(`[party.gateway] among auto-start failed for party ${partyId}:`, e);
    }
  }

  private async runAmongSweep(): Promise<void> {
    try {
      for (const pid of await this.among.sweepAutoMeetings()) {
        await this.rebroadcastAmong(pid);
      }
      for (const pid of await this.among.sweepMeetings()) {
        await this.rebroadcastAmong(pid);
      }
      // AI 봇 틱 — 프레즌스가 있는(비어있지 않은) 파티만 연산(빈 파티는 among 세션도 없다).
      for (const partyId of this.presence.keys()) {
        const pos = Object.fromEntries(this.humanPos.get(partyId) ?? []);
        const out = await this.among.runBotTick(partyId, pos).catch(() => null);
        if (!out) continue;
        for (const m of out.step.moves) {
          this.server.to(partyId).emit("party:moved", { profileId: m.profileId, x: m.x, y: m.y });
        }
        if (out.step.kill || out.state.phase === "ended") await this.rebroadcastAmong(partyId);
        for (const v of out.step.votes) void this.castAiVote(partyId, v.profileId);
        for (const c of out.step.chats) void this.sayAsAi(partyId, c.profileId, "idle");
      }
    } catch {
      // 스윕은 절대 죽지 않는다
    }
  }

  /** AI 임포스터의 투표 — LLM 가능하면 pickVote, 아니면 살아있는 인간 중 무작위. */
  private async castAiVote(partyId: string, aiProfileId: string): Promise<void> {
    try {
      const state = await this.among.current(partyId);
      if (!state || state.phase !== "voting") return;
      const me = state.players.find((p) => p.profileId === aiProfileId);
      const bot = state.ai?.bots?.[aiProfileId];
      const persona = me && bot ? { profileId: me.profileId, name: me.name, ...bot.persona } : null;
      const candidates = state.players
        .filter((p) => p.alive && !p.isAi)
        .map((p) => ({ profileId: p.profileId, name: p.name }));
      let target: string | null = null;
      if (persona && this.canCallLlm(state)) {
        target = await this.aiChat.pickVote({
          persona,
          recentChat: this.chatBuf.get(partyId) ?? [],
          candidates,
        });
        await this.among.bumpLlmCalls(partyId);
      }
      if (!target && candidates.length > 0) {
        target = candidates[Math.floor(Math.random() * candidates.length)]!.profileId;
      }
      if (!target) return;
      const s = await this.among.vote(partyId, aiProfileId, target);
      this.broadcastAmong(partyId, s);
    } catch {
      /* AI 투표 실패는 스킵 처리로 수렴 — 다음 스윕/타임아웃이 회의를 진행시킨다 */
    }
  }

  /** AI 임포스터의 발화 — LLM 가능하면 say, 아니면 페르소나 무관 템플릿 폴백. */
  private async sayAsAi(
    partyId: string,
    aiProfileId: string,
    scene: "idle" | "meeting",
  ): Promise<void> {
    try {
      const state = await this.among.current(partyId);
      if (!state) return;
      const me = state.players.find((p) => p.profileId === aiProfileId && p.alive);
      const bot = state.ai?.bots?.[aiProfileId];
      if (!me || !bot) return;
      const persona = { profileId: me.profileId, name: me.name, ...bot.persona };
      let text: string | null = null;
      if (this.canCallLlm(state)) {
        text = await this.aiChat.say({
          persona,
          scene,
          recentChat: this.chatBuf.get(partyId) ?? [],
          aliveNames: state.players.filter((p) => p.alive).map((p) => p.name),
        });
        await this.among.bumpLlmCalls(partyId);
      }
      if (!text) text = fallbackLine(scene);
      // 타이핑 지연 리얼리즘(글자수 비례, 상한 4s) — 즉시 도착하면 봇 티가 난다.
      await new Promise((r) => setTimeout(r, Math.min(text!.length * 80, 4000)));
      this.server.to(partyId).emit("party:message", {
        id: `ai-${randomUUID()}`,
        partyId,
        profileId: aiProfileId,
        content: text,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* 발화 실패는 침묵 — 다음 발화 타이밍에 재시도 */
    }
  }

  private canCallLlm(state: AmongState): boolean {
    return this.aiChat.enabled && state.ai.llmCalls < this.amongConfig.value.aiLlmMaxCalls;
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
      const s = await this.among.start(body.partyId, roster, { llmEnabled: this.aiChat.enabled });
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
