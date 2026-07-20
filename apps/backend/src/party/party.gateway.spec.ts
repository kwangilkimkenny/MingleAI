import { BadRequestException, ConflictException } from "@nestjs/common";
import { PartyGateway } from "./party.gateway";

const jwt = { verify: jest.fn() } as any;
const party = {
  assertParticipant: jest.fn(),
  addPartyMessage: jest.fn(),
  findOne: jest.fn(),
} as any;
const game = {
  start: jest.fn(),
  vote: jest.fn(),
  end: jest.fn(),
  current: jest.fn(),
} as any;

const fakeAmongState = {
  sessionId: "ag1",
  phase: "playing",
  players: [],
  tasks: [],
  bodies: [],
  meeting: null,
  lastEjected: null,
  result: null,
};
const fakeSnapshot = { sessionId: "ag1", phase: "playing", myRole: "crew" };

const among = {
  start: jest.fn(),
  doTask: jest.fn(),
  kill: jest.fn(),
  report: jest.fn(),
  emergency: jest.fn(),
  vote: jest.fn(),
  current: jest.fn(),
  latestAmong: jest.fn(),
  end: jest.fn(),
  sweepMeetings: jest.fn(),
  sweepAutoMeetings: jest.fn(),
  runBotTick: jest.fn(),
  bumpLlmCalls: jest.fn(),
  project: jest.fn(),
} as any;

const amongConfig = { value: { sweepMs: 99999, minPlayers: 4, aiLlmMaxCalls: 60 } } as any;

/** Bare ConfigService stand-in — createAiChatClient only ever calls `.get(key)`. */
function makeConfigService(overrides: Record<string, string | undefined> = {}) {
  return { get: jest.fn((key: string) => overrides[key]) } as any;
}

function gatewayWith(configService = makeConfigService()) {
  const gw = new PartyGateway(jwt, party, game, among, amongConfig, configService);
  (gw as any).server = {
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };
  return gw;
}

function clientWith(userId?: string) {
  return {
    id: `sock-${Math.random()}`,
    data: userId ? { userId } : {},
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    disconnect: jest.fn(),
    handshake: { auth: {} },
  } as any;
}

beforeEach(() => jest.clearAllMocks());

it("handleConnection with no token disconnects", () => {
  const gw = gatewayWith();
  const client = clientWith();
  gw.handleConnection(client);
  expect(client.disconnect).toHaveBeenCalled();
});

it("handleConnection with invalid token disconnects without throwing", () => {
  jwt.verify.mockImplementationOnce(() => {
    throw new Error("bad");
  });
  const gw = gatewayWith();
  const client = clientWith();
  client.handshake.auth.token = "bad.token";
  expect(() => gw.handleConnection(client)).not.toThrow();
  expect(client.disconnect).toHaveBeenCalled();
});

it("party:join joins the room, registers presence, broadcasts the roster", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  expect(client.join).toHaveBeenCalledWith("pt1");
  expect(to).toHaveBeenCalledWith("pt1");
  const emit = to.mock.results[0].value.emit;
  expect(emit).toHaveBeenCalledWith("party:presence", { partyId: "pt1", members: ["pf1"] });
});

it("party:join refuses a non-participant with an error emit", async () => {
  party.assertParticipant.mockResolvedValueOnce(null);
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  expect(client.join).not.toHaveBeenCalled();
  expect(client.emit).toHaveBeenCalledWith("party:error", { message: "forbidden" });
});

it("party:chat persists then broadcasts party:message to the room", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const view = { id: "m1", partyId: "pt1", profileId: "pf1", content: "hi", createdAt: "t" };
  party.addPartyMessage.mockResolvedValueOnce(view);
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleChat(client, { partyId: "pt1", content: "hi" });
  expect(party.addPartyMessage).toHaveBeenCalledWith("pf1", "pt1", "hi");
  expect(to).toHaveBeenCalledWith("pt1");
  expect(to.mock.results[0].value.emit).toHaveBeenCalledWith("party:message", view);
});

it("party:chat surfaces a validation failure as an error emit (no throw)", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  party.addPartyMessage.mockRejectedValueOnce(new Error("bad"));
  const gw = gatewayWith();
  const client = clientWith("u1");
  await expect(gw.handleChat(client, { partyId: "pt1", content: "" })).resolves.toBeUndefined();
  expect(client.emit).toHaveBeenCalledWith("party:error", { message: "invalid" });
});

it("party:move broadcasts party:moved to others using join-time membership", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  gw.handleMove(client, { partyId: "pt1", x: 1, y: 2 });
  expect(client.to).toHaveBeenCalledWith("pt1");
  expect(client.to.mock.results[0].value.emit).toHaveBeenCalledWith("party:moved", {
    profileId: "pf1",
    x: 1,
    y: 2,
  });
});

it("party:move from a socket that never joined is ignored", () => {
  const gw = gatewayWith();
  const client = clientWith("u1");
  gw.handleMove(client, { partyId: "pt1", x: 1, y: 2 });
  expect(client.to).not.toHaveBeenCalled();
});

it("party:move가 humanPos 맵을 갱신하고 disconnect 시 정리된다", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });

  gw.handleMove(client, { partyId: "pt1", x: 0.4, y: 0.6 });
  expect((gw as any).humanPos.get("pt1")?.get("pf1")).toEqual({ x: 0.4, y: 0.6 });

  gw.handleDisconnect(client);
  expect((gw as any).humanPos.get("pt1")?.get("pf1")).toBeUndefined();
  expect((gw as any).humanPos.has("pt1")).toBe(false);
});

it("party:move가 humanPos 맵을 갱신하고 party:leave 시 정리된다", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });

  gw.handleMove(client, { partyId: "pt1", x: 0.1, y: 0.9 });
  expect((gw as any).humanPos.get("pt1")?.get("pf1")).toEqual({ x: 0.1, y: 0.9 });

  gw.handleLeave(client, { partyId: "pt1" });
  expect((gw as any).humanPos.has("pt1")).toBe(false);
});

it("handleDisconnect removes presence and re-broadcasts the roster", async () => {
  party.assertParticipant.mockResolvedValue("pf1");
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  gw.handleDisconnect(client);
  const lastEmit = to.mock.results.at(-1)!.value.emit;
  expect(lastEmit).toHaveBeenCalledWith("party:presence", { partyId: "pt1", members: [] });
  expect((gw as any).presence.has("pt1")).toBe(false);
});

it("party:leave leaves the room, deregisters presence, and re-broadcasts the roster", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  gw.handleLeave(client, { partyId: "pt1" });
  expect(client.leave).toHaveBeenCalledWith("pt1");
  const lastEmit = to.mock.results.at(-1)!.value.emit;
  expect(lastEmit).toHaveBeenCalledWith("party:presence", { partyId: "pt1", members: [] });
  expect((gw as any).presence.has("pt1")).toBe(false);
});

it("game:start broadcasts the snapshot to the room", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const snap = { sessionId: "g1", status: "active" };
  game.start.mockResolvedValueOnce(snap);
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleGameStart(client, { partyId: "pt1" });
  expect(to).toHaveBeenCalledWith("pt1");
  expect(to.mock.results[0].value.emit).toHaveBeenCalledWith("game:state", {
    partyId: "pt1",
    snapshot: snap,
  });
});

it("game:start maps a Conflict to an already-active error emit", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const { ConflictException } = require("@nestjs/common");
  game.start.mockRejectedValueOnce(new ConflictException("already-active"));
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleGameStart(client, { partyId: "pt1" });
  expect(client.emit).toHaveBeenCalledWith("party:error", { message: "already-active" });
});

it("game:vote passes the present roster and broadcasts", async () => {
  party.assertParticipant.mockResolvedValue("pf1");
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  const snap = { sessionId: "g1" };
  game.vote.mockResolvedValueOnce(snap);
  await gw.handleGameVote(client, { partyId: "pt1", choice: "a" });
  expect(game.vote).toHaveBeenCalledWith("pt1", "pf1", "a", ["pf1"]);
  const lastEmit = to.mock.results.at(-1)!.value.emit;
  expect(lastEmit).toHaveBeenCalledWith("game:state", { partyId: "pt1", snapshot: snap });
});

it("game:sync answers only the requesting socket", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  game.current.mockResolvedValueOnce(null);
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleGameSync(client, { partyId: "pt1" });
  expect(client.emit).toHaveBeenCalledWith("game:state", { partyId: "pt1", snapshot: null });
  expect((gw as any).server.to).not.toHaveBeenCalled();
});

it("game:end broadcasts the ended snapshot", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const snap = { sessionId: "g1", status: "ended" };
  game.end.mockResolvedValueOnce(snap);
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleGameEnd(client, { partyId: "pt1" });
  expect(to.mock.results.at(-1)!.value.emit).toHaveBeenCalledWith("game:state", {
    partyId: "pt1",
    snapshot: snap,
  });
});

// ---------------------------------------------------------------------------
// balance (game:*) end → retry Among Us auto-start (rescues the pre-emption
// case where the balance game started before the 4th socket joined, so that
// join's auto-start attempt raced into a Conflict and was swallowed)
// ---------------------------------------------------------------------------

async function fillRoster(gw: any, partyId: string, count = 4) {
  for (let i = 1; i <= count; i++) {
    party.assertParticipant.mockResolvedValueOnce(`pf${i}`);
    const client = clientWith(`u${i}`);
    client.id = `sock-${i}`;
    await gw.handleJoin(client, { partyId });
  }
}

it("game:end retries the Among Us auto-start after the 4th join's attempt was pre-empted by the still-active balance session", async () => {
  party.findOne.mockResolvedValue({ participantCount: 4 });
  among.latestAmong.mockResolvedValue(null); // Among has never successfully started
  // 1st attempt — fired by the 4th join while the balance session is still active — conflicts,
  // exactly like the real AmongService.start does (findActiveAny sees the active GameSession row
  // regardless of gameType).
  among.start.mockRejectedValueOnce(new ConflictException("already-active"));
  // 2nd attempt — retried once the balance session has ended — succeeds.
  among.start.mockResolvedValueOnce(fakeAmongState);
  among.project.mockReturnValue(fakeSnapshot);

  const gw = gatewayWith();
  await fillRoster(gw, "pt1");
  expect(among.start).toHaveBeenCalledTimes(1); // pre-emption happened, join itself did not fail

  party.assertParticipant.mockResolvedValueOnce("pf1");
  const snap = { sessionId: "g1", status: "ended" };
  game.end.mockResolvedValueOnce(snap);
  const client = clientWith("u1");
  await gw.handleGameEnd(client, { partyId: "pt1" });

  expect(among.start).toHaveBeenCalledTimes(2);
  expect(among.start.mock.calls[1][0]).toBe("pt1");
  expect(among.start.mock.calls[1][1]).toHaveLength(4);
});

it("game:end does not retry the auto-start when an Among Us session already existed", async () => {
  party.findOne.mockResolvedValue({ participantCount: 4 });
  among.latestAmong.mockResolvedValue({ ...fakeAmongState, phase: "ended" });

  const gw = gatewayWith();
  await fillRoster(gw, "pt1");

  party.assertParticipant.mockResolvedValueOnce("pf1");
  game.end.mockResolvedValueOnce({ sessionId: "g1", status: "ended" });
  const client = clientWith("u1");
  await gw.handleGameEnd(client, { partyId: "pt1" });

  expect(among.start).not.toHaveBeenCalled();
});

it("game:vote's natural end (final round) retries the Among Us auto-start after pre-emption by the still-active balance session", async () => {
  party.findOne.mockResolvedValue({ participantCount: 4 });
  among.latestAmong.mockResolvedValue(null);
  among.start.mockRejectedValueOnce(new ConflictException("already-active")); // pre-empted at the 4th join
  among.start.mockResolvedValueOnce(fakeAmongState); // retried after the balance game ends
  among.project.mockReturnValue(fakeSnapshot);

  const gw = gatewayWith();
  await fillRoster(gw, "pt1");
  expect(among.start).toHaveBeenCalledTimes(1);

  party.assertParticipant.mockResolvedValueOnce("pf1");
  const snap = { sessionId: "g1", status: "ended" };
  game.vote.mockResolvedValueOnce(snap);
  const client = clientWith("u1");
  await gw.handleGameVote(client, { partyId: "pt1", choice: "a" });

  expect(among.start).toHaveBeenCalledTimes(2);
  expect(among.start.mock.calls[1][0]).toBe("pt1");
  expect(among.start.mock.calls[1][1]).toHaveLength(4);
});

it("game:vote's natural end does not retry the auto-start when an Among Us session already existed", async () => {
  party.findOne.mockResolvedValue({ participantCount: 4 });
  among.latestAmong.mockResolvedValue({ ...fakeAmongState, phase: "ended" });

  const gw = gatewayWith();
  await fillRoster(gw, "pt1");

  party.assertParticipant.mockResolvedValueOnce("pf1");
  game.vote.mockResolvedValueOnce({ sessionId: "g1", status: "ended" });
  const client = clientWith("u1");
  await gw.handleGameVote(client, { partyId: "pt1", choice: "a" });

  expect(among.start).not.toHaveBeenCalled();
});

it("game:vote does not attempt an auto-start retry when the round is still active", async () => {
  const gw = gatewayWith();

  party.assertParticipant.mockResolvedValueOnce("pf1");
  game.vote.mockResolvedValueOnce({ sessionId: "g1", status: "active" });
  const client = clientWith("u1");
  await gw.handleGameVote(client, { partyId: "pt1", choice: "a" });

  expect(among.latestAmong).not.toHaveBeenCalled();
  expect(among.start).not.toHaveBeenCalled();
});

it("game handlers refuse non-participants", async () => {
  party.assertParticipant.mockResolvedValueOnce(null);
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleGameStart(client, { partyId: "pt1" });
  expect(client.emit).toHaveBeenCalledWith("party:error", { message: "forbidden" });
  expect(game.start).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// among:* handler tests
// ---------------------------------------------------------------------------

it("among:start refuses a non-participant and does not call among.start", async () => {
  party.assertParticipant.mockResolvedValueOnce(null);
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleAmongStart(client, { partyId: "pt1" });
  expect(client.emit).toHaveBeenCalledWith("party:error", { message: "forbidden" });
  expect(among.start).not.toHaveBeenCalled();
});

it("among:start calls among.start with presence roster and broadcasts personalized snapshots", async () => {
  // Two participants in the room
  party.assertParticipant.mockResolvedValue("pf1");
  const gw = gatewayWith();
  const to = (gw as any).server.to;

  // Socket 1 joins
  const client1 = clientWith("u1");
  client1.id = "sock-1";
  await gw.handleJoin(client1, { partyId: "pt1" });

  // Socket 2 joins (different user)
  party.assertParticipant.mockResolvedValueOnce("pf2");
  const client2 = clientWith("u2");
  client2.id = "sock-2";
  await gw.handleJoin(client2, { partyId: "pt1" });

  jest.clearAllMocks();
  // Reset to mock returns fresh server.to
  (gw as any).server = {
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };
  const toFresh = (gw as any).server.to;

  among.start.mockResolvedValueOnce(fakeAmongState);
  among.project.mockReturnValue(fakeSnapshot);

  party.assertParticipant.mockResolvedValueOnce("pf1");
  await gw.handleAmongStart(client1, { partyId: "pt1" });

  // among.start called with the 2-player roster (both pf1 and pf2) and the AI-enabled opts
  expect(among.start).toHaveBeenCalledWith(
    "pt1",
    expect.arrayContaining([
      { profileId: "pf1", isBot: false },
      { profileId: "pf2", isBot: false },
    ]),
    { llmEnabled: false },
  );
  expect(among.start.mock.calls[0][1]).toHaveLength(2);

  // project called once per socket (personalized)
  expect(among.project).toHaveBeenCalledWith(fakeAmongState, "pf1");
  expect(among.project).toHaveBeenCalledWith(fakeAmongState, "pf2");

  // server.to(socketId).emit called for each socket
  expect(toFresh).toHaveBeenCalledWith("sock-1");
  expect(toFresh).toHaveBeenCalledWith("sock-2");
  const allEmitCalls = toFresh.mock.results.map((r: any) => r.value.emit);
  for (const emitFn of allEmitCalls) {
    expect(emitFn).toHaveBeenCalledWith("among:state", {
      partyId: "pt1",
      snapshot: fakeSnapshot,
    });
  }
});

it("among:sync emits among:state only to the requesting socket using current-or-latest", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  among.current.mockResolvedValueOnce(null);
  among.latestAmong.mockResolvedValueOnce(fakeAmongState);
  among.project.mockReturnValueOnce(fakeSnapshot);

  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleAmongSync(client, { partyId: "pt1" });

  expect(among.current).toHaveBeenCalledWith("pt1");
  expect(among.latestAmong).toHaveBeenCalledWith("pt1");
  expect(among.project).toHaveBeenCalledWith(fakeAmongState, "pf1");
  expect(client.emit).toHaveBeenCalledWith("among:state", {
    partyId: "pt1",
    snapshot: fakeSnapshot,
  });
  // must NOT broadcast to the room
  expect((gw as any).server.to).not.toHaveBeenCalled();
});

it("among:start maps BadRequestException('not-enough-players') to that exact message", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  among.start.mockRejectedValueOnce(new BadRequestException("not-enough-players"));

  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleAmongStart(client, { partyId: "pt1" });

  expect(client.emit).toHaveBeenCalledWith("party:error", { message: "not-enough-players" });
});

it("among:start maps a generic BadRequestException to 'invalid'", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  among.start.mockRejectedValueOnce(new BadRequestException("something-else"));

  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleAmongStart(client, { partyId: "pt1" });

  expect(client.emit).toHaveBeenCalledWith("party:error", { message: "invalid" });
});

it("among:start maps BadRequestException('ai-unavailable') to the Korean readiness message", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  among.start.mockRejectedValueOnce(new BadRequestException("ai-unavailable"));

  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleAmongStart(client, { partyId: "pt1" });

  expect(client.emit).toHaveBeenCalledWith("party:error", {
    message: "AI 게임 준비 중이에요",
  });
});

// ---------------------------------------------------------------------------
// llmEnabled passthrough — among.start's aiRequireLlm gate depends on this opt
// reaching it on EVERY start path, or every start throws ai-unavailable once
// AMONG_AI_REQUIRE_LLM is on.
// ---------------------------------------------------------------------------

it("among:start passes llmEnabled:false through when the AI chat client has no LLM configured", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  among.start.mockResolvedValueOnce(fakeAmongState);
  among.project.mockReturnValue(fakeSnapshot);

  const gw = gatewayWith(makeConfigService()); // no LLM_API_URL → disabled
  const client = clientWith("u1");
  await gw.handleAmongStart(client, { partyId: "pt1" });

  expect(among.start).toHaveBeenCalledWith("pt1", [], { llmEnabled: false });
});

it("among:start passes llmEnabled:true through when the AI chat client has an LLM configured", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  among.start.mockResolvedValueOnce(fakeAmongState);
  among.project.mockReturnValue(fakeSnapshot);

  const gw = gatewayWith(makeConfigService({ LLM_API_URL: "http://llm.local" }));
  const client = clientWith("u1");
  await gw.handleAmongStart(client, { partyId: "pt1" });

  expect(among.start).toHaveBeenCalledWith("pt1", [], { llmEnabled: true });
});

it("party:join's auto-start also passes llmEnabled through", async () => {
  party.findOne.mockResolvedValue({ participantCount: 4 });
  among.latestAmong.mockResolvedValue(null);
  among.start.mockResolvedValueOnce(fakeAmongState);
  among.project.mockReturnValue(fakeSnapshot);

  const gw = gatewayWith(makeConfigService({ LLM_API_URL: "http://llm.local" }));
  for (let i = 1; i <= 4; i++) {
    party.assertParticipant.mockResolvedValueOnce(`pf${i}`);
    const client = clientWith(`u${i}`);
    client.id = `sock-${i}`;
    await gw.handleJoin(client, { partyId: "pt1" });
  }

  expect(among.start.mock.calls[0][2]).toEqual({ llmEnabled: true });
});

// ---------------------------------------------------------------------------
// party:join → auto-start Among Us once the party fills up
// ---------------------------------------------------------------------------

it("party:join auto-starts Among Us once the roster fills the party (no session has ever existed)", async () => {
  party.findOne.mockResolvedValue({ participantCount: 4 });
  among.latestAmong.mockResolvedValue(null);
  among.start.mockResolvedValueOnce(fakeAmongState);
  among.project.mockReturnValue(fakeSnapshot);

  const gw = gatewayWith();
  const to = (gw as any).server.to;

  for (let i = 1; i <= 4; i++) {
    party.assertParticipant.mockResolvedValueOnce(`pf${i}`);
    const client = clientWith(`u${i}`);
    client.id = `sock-${i}`;
    await gw.handleJoin(client, { partyId: "pt1" });
  }

  // start called exactly once, with the full 4-member roster
  expect(among.start).toHaveBeenCalledTimes(1);
  expect(among.start.mock.calls[0][0]).toBe("pt1");
  expect(among.start.mock.calls[0][1]).toHaveLength(4);
  expect(among.start.mock.calls[0][1]).toEqual(
    expect.arrayContaining([
      { profileId: "pf1", isBot: false },
      { profileId: "pf2", isBot: false },
      { profileId: "pf3", isBot: false },
      { profileId: "pf4", isBot: false },
    ]),
  );

  // reuses the existing personalized among:state broadcast path
  const emit = to.mock.results[0].value.emit;
  expect(emit).toHaveBeenCalledWith("among:state", { partyId: "pt1", snapshot: fakeSnapshot });
});

it("party:join does not auto-start when an Among Us session already existed for the party (even ended)", async () => {
  party.findOne.mockResolvedValue({ participantCount: 4 });
  among.latestAmong.mockResolvedValue({ ...fakeAmongState, phase: "ended" });

  const gw = gatewayWith();

  for (let i = 1; i <= 4; i++) {
    party.assertParticipant.mockResolvedValueOnce(`pf${i}`);
    const client = clientWith(`u${i}`);
    client.id = `sock-${i}`;
    await gw.handleJoin(client, { partyId: "pt1" });
  }

  expect(among.start).not.toHaveBeenCalled();
});

it("party:join swallows a Conflict thrown by the auto-start race without failing the join", async () => {
  party.findOne.mockResolvedValue({ participantCount: 4 });
  among.latestAmong.mockResolvedValue(null);
  among.start.mockRejectedValueOnce(new ConflictException("already-active"));

  const gw = gatewayWith();
  let lastClient: any;
  for (let i = 1; i <= 4; i++) {
    party.assertParticipant.mockResolvedValueOnce(`pf${i}`);
    const client = clientWith(`u${i}`);
    client.id = `sock-${i}`;
    lastClient = client;
    await expect(gw.handleJoin(client, { partyId: "pt1" })).resolves.toBeUndefined();
  }

  expect(among.start).toHaveBeenCalledTimes(1);
  // join itself still succeeded — presence recorded, no error surfaced to the socket
  expect((gw as any).presence.get("pt1")?.get(lastClient.id)).toBe("pf4");
  expect(lastClient.emit).not.toHaveBeenCalledWith("party:error", expect.anything());
});

// ---------------------------------------------------------------------------
// Reviewer fixes: castAiVote reentrancy guard, chatBuf cleanup, sayAsAi
// post-delay re-validation.
// ---------------------------------------------------------------------------

const aiBotPersona = {
  age: 27,
  gender: "female" as const,
  occupation: "마케터",
  style: "무심한 말투",
};

function votingStateWith(aiAlive = true) {
  return {
    sessionId: "ag1",
    phase: "voting" as const,
    players: [
      {
        profileId: "ai-1",
        name: "AI1",
        role: "impostor" as const,
        alive: aiAlive,
        isBot: true,
        isAi: true,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "pf1",
        name: "P1",
        role: "crew" as const,
        alive: true,
        isBot: false,
        isAi: false,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
    ],
    tasks: [],
    bodies: [],
    meeting: {
      reason: "emergency" as const,
      calledBy: "pf1",
      discussionEndsAt: 0,
      voteEndsAt: 0,
      votes: {},
    },
    lastEjected: null,
    result: null,
    nextAutoMeetingAt: 0,
    ai: {
      llmCalls: 0,
      bots: {
        "ai-1": {
          x: 0.5,
          y: 0.5,
          targetIdx: 0,
          nextChatAt: 0,
          killHoldUntil: 0,
          persona: aiBotPersona,
        },
      },
    },
  };
}

it("castAiVote는 재진입하지 않는다 — pickVote가 pending인 동안 두 번째 호출은 즉시 반환한다", async () => {
  jest.useFakeTimers();
  try {
    const state = votingStateWith();
    among.current.mockResolvedValue(state);
    among.vote.mockResolvedValue(state);
    among.bumpLlmCalls.mockResolvedValue(undefined);
    among.project.mockReturnValue(fakeSnapshot);

    const gw = gatewayWith();
    let resolvePickVote!: (v: string | null) => void;
    const pending = new Promise<string | null>((resolve) => {
      resolvePickVote = resolve;
    });
    const pickVote = jest.fn().mockReturnValue(pending);
    (gw as any).aiChat = { enabled: true, pickVote, say: jest.fn() };

    const p1 = (gw as any).castAiVote("pt1", "ai-1");
    // Dispatched again before the first pickVote round-trip resolved — must be a no-op.
    const p2 = (gw as any).castAiVote("pt1", "ai-1");

    // 즉시 몰표 방지 지연(최대 10s)을 흘려보낸 뒤에야 pickVote가 호출된다.
    await jest.advanceTimersByTimeAsync(10000);
    resolvePickVote("pf1");
    await p1;
    await p2;

    expect(pickVote).toHaveBeenCalledTimes(1);
    expect(among.vote).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it("castAiVote는 완료 후(finally) in-flight 표시를 해제해 다음 호출은 다시 실행된다", async () => {
  jest.useFakeTimers();
  try {
    const state = votingStateWith();
    among.current.mockResolvedValue(state);
    among.vote.mockResolvedValue(state);
    among.bumpLlmCalls.mockResolvedValue(undefined);
    among.project.mockReturnValue(fakeSnapshot);

    const gw = gatewayWith();
    const pickVote = jest.fn().mockResolvedValue("pf1");
    (gw as any).aiChat = { enabled: true, pickVote, say: jest.fn() };

    const p1 = (gw as any).castAiVote("pt1", "ai-1");
    await jest.advanceTimersByTimeAsync(10000);
    await p1;

    const p2 = (gw as any).castAiVote("pt1", "ai-1");
    await jest.advanceTimersByTimeAsync(10000);
    await p2;

    expect(pickVote).toHaveBeenCalledTimes(2);
    expect(among.vote).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

it("party:leave가 마지막 멤버면 chatBuf를 정리한다", async () => {
  party.assertParticipant.mockResolvedValue("pf1");
  party.addPartyMessage.mockResolvedValueOnce({
    id: "m1",
    partyId: "pt1",
    profileId: "pf1",
    content: "hi",
    createdAt: "t",
  });

  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  await gw.handleChat(client, { partyId: "pt1", content: "hi" });
  expect((gw as any).chatBuf.get("pt1")).toEqual(["hi"]);

  gw.handleLeave(client, { partyId: "pt1" });
  expect((gw as any).chatBuf.has("pt1")).toBe(false);
});

it("handleDisconnect가 마지막 멤버면 chatBuf를 정리한다", async () => {
  party.assertParticipant.mockResolvedValue("pf1");
  party.addPartyMessage.mockResolvedValueOnce({
    id: "m1",
    partyId: "pt1",
    profileId: "pf1",
    content: "hi",
    createdAt: "t",
  });

  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  await gw.handleChat(client, { partyId: "pt1", content: "hi" });
  expect((gw as any).chatBuf.get("pt1")).toEqual(["hi"]);

  gw.handleDisconnect(client);
  expect((gw as any).chatBuf.has("pt1")).toBe(false);
});

it("party:leave가 마지막 멤버가 아니면 chatBuf를 유지한다", async () => {
  party.assertParticipant.mockResolvedValue("pf1");
  party.addPartyMessage.mockResolvedValueOnce({
    id: "m1",
    partyId: "pt1",
    profileId: "pf1",
    content: "hi",
    createdAt: "t",
  });

  const gw = gatewayWith();
  const client1 = clientWith("u1");
  client1.id = "sock-1";
  await gw.handleJoin(client1, { partyId: "pt1" });
  party.assertParticipant.mockResolvedValueOnce("pf2");
  const client2 = clientWith("u2");
  client2.id = "sock-2";
  await gw.handleJoin(client2, { partyId: "pt1" });

  await gw.handleChat(client1, { partyId: "pt1", content: "hi" });
  gw.handleLeave(client1, { partyId: "pt1" });

  expect((gw as any).chatBuf.get("pt1")).toEqual(["hi"]);
});

it("sayAsAi는 타이핑 지연 동안 봇이 죽으면 발화를 폐기한다", async () => {
  jest.useFakeTimers();
  try {
    const aliveState = votingStateWith();
    aliveState.phase = "playing" as any;
    const deadState = votingStateWith(false);
    deadState.phase = "playing" as any;
    among.current.mockResolvedValueOnce(aliveState).mockResolvedValueOnce(deadState);

    const gw = gatewayWith();
    (gw as any).aiChat = { enabled: false, pickVote: jest.fn(), say: jest.fn() };
    const to = (gw as any).server.to as jest.Mock;

    const p = (gw as any).sayAsAi("pt1", "ai-1", "idle");
    await jest.advanceTimersByTimeAsync(4000);
    await p;

    expect(to).not.toHaveBeenCalledWith("pt1");
  } finally {
    jest.useRealTimers();
  }
});

it("sayAsAi는 idle 잡담이 지연 중 회의로 전환되면 발화를 폐기한다", async () => {
  jest.useFakeTimers();
  try {
    const aliveState = votingStateWith();
    aliveState.phase = "playing" as any;
    const meetingState = votingStateWith();
    meetingState.phase = "meeting" as any;
    among.current.mockResolvedValueOnce(aliveState).mockResolvedValueOnce(meetingState);

    const gw = gatewayWith();
    (gw as any).aiChat = { enabled: false, pickVote: jest.fn(), say: jest.fn() };
    const to = (gw as any).server.to as jest.Mock;

    const p = (gw as any).sayAsAi("pt1", "ai-1", "idle");
    await jest.advanceTimersByTimeAsync(4000);
    await p;

    expect(to).not.toHaveBeenCalledWith("pt1");
  } finally {
    jest.useRealTimers();
  }
});

it("sayAsAi는 재검증을 통과하면 party:message를 방송한다", async () => {
  jest.useFakeTimers();
  try {
    const state = votingStateWith();
    state.phase = "playing" as any;
    among.current.mockResolvedValue(state);

    const gw = gatewayWith();
    (gw as any).aiChat = { enabled: false, pickVote: jest.fn(), say: jest.fn() };
    const to = (gw as any).server.to as jest.Mock;

    const p = (gw as any).sayAsAi("pt1", "ai-1", "idle");
    await jest.advanceTimersByTimeAsync(4000);
    await p;

    expect(to).toHaveBeenCalledWith("pt1");
    const emit = to.mock.results.at(-1)!.value.emit;
    expect(emit).toHaveBeenCalledWith(
      "party:message",
      expect.objectContaining({ partyId: "pt1", profileId: "ai-1" }),
    );
  } finally {
    jest.useRealTimers();
  }
});

// ---------------------------------------------------------------------------
// C1 — 회의 소집 시 AI 발화 파견 (스펙 §4)
// ---------------------------------------------------------------------------

function meetingStateWithMixedAis(): any {
  return {
    sessionId: "ag1",
    phase: "meeting" as const,
    players: [
      {
        profileId: "ai-1",
        name: "AI1",
        role: "impostor" as const,
        alive: true,
        isBot: true,
        isAi: true,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "ai-2",
        name: "AI2",
        role: "impostor" as const,
        alive: true,
        isBot: true,
        isAi: true,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        // 이미 죽은 AI는 발화 대상이 아니다.
        profileId: "ai-3",
        name: "AI3",
        role: "impostor" as const,
        alive: false,
        isBot: true,
        isAi: true,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "p1",
        name: "P1",
        role: "crew" as const,
        alive: true,
        isBot: false,
        isAi: false,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
    ],
    tasks: [],
    bodies: [{ profileId: "p2", x: 0.5, y: 0.5, reported: true }],
    meeting: {
      reason: "report" as const,
      calledBy: "p1",
      bodyProfileId: "p2",
      discussionEndsAt: 555000,
      voteEndsAt: 585000,
      votes: {},
    },
    lastEjected: null,
    result: null,
    nextAutoMeetingAt: 0,
    ai: { llmCalls: 0, bots: {} },
  };
}

it("among:report로 회의가 소집되면(리브로드캐스트 시점) 생존 AI 수만큼 sayAsAi 발화가 스케줄된다", async () => {
  jest.useFakeTimers();
  try {
    party.assertParticipant.mockResolvedValueOnce("p1");
    const state = meetingStateWithMixedAis();
    among.report.mockResolvedValueOnce(state);
    among.project.mockReturnValue(fakeSnapshot);

    const gw = gatewayWith();
    const sayAsAiSpy = jest.spyOn(gw as any, "sayAsAi").mockResolvedValue(undefined);
    const client = clientWith("u1");

    await gw.handleAmongReport(client, { partyId: "pt1", bodyProfileId: "p2" });
    // 랜덤 지연 상한(8s)까지 흘려보내면 생존 AI(ai-1, ai-2) 각각 1회씩만 스케줄되어야 한다
    // — 죽은 ai-3과 인간 p1은 대상이 아니다.
    await jest.advanceTimersByTimeAsync(8000);

    expect(sayAsAiSpy).toHaveBeenCalledTimes(2);
    expect(sayAsAiSpy).toHaveBeenCalledWith("pt1", "ai-1", "meeting");
    expect(sayAsAiSpy).toHaveBeenCalledWith("pt1", "ai-2", "meeting");

    // 같은 회의(discussionEndsAt 동일)를 다시 리브로드캐스트해도 중복 파견하지 않는다.
    (gw as any).dispatchMeetingAiSpeech("pt1", state);
    await jest.advanceTimersByTimeAsync(8000);
    expect(sayAsAiSpy).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});
