import { SpeedDateGateway } from "./speed-date.gateway";
import type { SpeedDateState } from "./speed-date.state";

/**
 * 게이트웨이는 소켓 계약의 마지막 관문이다 — 참가자 확인, 선택의 비공개 에코, LiveKit 발행 권한,
 * presence 정리. 여기 구멍이 나면 세션 프라이버시가 그대로 뚫린다(2026-08-11 감사에서 미검증 구간).
 */

const CONFIG = { sweepMs: 2500, roundMs: 300_000 };

function stateAt(phase: SpeedDateState["phase"], overrides: Partial<SpeedDateState> = {}): SpeedDateState {
  return {
    phase,
    stageIndex: 0,
    roundIndex: 0,
    stageCount: 3,
    roundCount: 3,
    stageOrder: ["DISGUISED", "VOICE", "FACE"],
    phaseEndsAt: Date.now() + 60_000,
    participants: [
      { profileId: "pa", nickname: "바다 수달", gender: "male", avatarId: "a1" },
      { profileId: "pd", nickname: "산 여우", gender: "female", avatarId: "a2" },
    ],
    schedule: [[["pa", "pd"]]],
    choices: {},
    matches: [],
    ...overrides,
  } as SpeedDateState;
}

function make(opts: {
  participantOf?: string | null;
  state?: SpeedDateState | null;
  choose?: SpeedDateState | null;
  mintToken?: string;
} = {}) {
  const sessions = {
    // ?? 를 쓰면 null(="참가자 아님", "세션 없음")이 기본값으로 삼켜진다 — 명시적으로 갈라야 한다.
    assertParticipant: jest
      .fn()
      .mockResolvedValue(opts.participantOf === undefined ? "pa" : opts.participantOf),
    loadState: jest.fn().mockResolvedValue(opts.state === undefined ? stateAt("preflight") : opts.state),
    choose: jest.fn().mockResolvedValue(opts.choose === undefined ? stateAt("round") : opts.choose),
    advanceAllActive: jest.fn().mockResolvedValue([]),
  };
  const token = {
    mint: jest.fn().mockResolvedValue({ token: opts.mintToken ?? "lk-token", url: "ws://lk" }),
  };
  const accountAccess = { findActive: jest.fn().mockResolvedValue({ userId: "ua", role: "user" }) };
  const gw = new SpeedDateGateway(
    { verify: jest.fn() } as never,
    sessions as never,
    { value: CONFIG } as never,
    token as never,
    accountAccess as never,
  );
  (gw as unknown as { server: unknown }).server = { sockets: { sockets: new Map() } };
  return { gw, sessions, token, accountAccess };
}

function socket(id = "s1", userId: string | undefined = "ua") {
  return { id, data: { userId }, emit: jest.fn(), disconnect: jest.fn() } as never as {
    id: string;
    data: { userId?: string };
    emit: jest.Mock;
    disconnect: jest.Mock;
  };
}

describe("SpeedDateGateway 소켓 계약", () => {
  it("참가자는 join하면 presence에 등록되고 스냅샷을 받는다", async () => {
    const { gw } = make();
    const client = socket();
    await gw.handleJoin(client as never, { sessionId: "sess1" });

    expect(client.emit).toHaveBeenCalledWith(
      "speeddate:snapshot",
      expect.objectContaining({ sessionId: "sess1" }),
    );
    const presence = (gw as unknown as { presence: Map<string, Map<string, string>> }).presence;
    expect(presence.get("sess1")?.get("s1")).toBe("pa");
  });

  it("참가자가 아니면 forbidden이고 presence에도 안 남는다", async () => {
    const { gw } = make({ participantOf: null });
    const client = socket();
    await gw.handleJoin(client as never, { sessionId: "sess1" });

    expect(client.emit).toHaveBeenCalledWith("speeddate:error", { message: "forbidden" });
    const presence = (gw as unknown as { presence: Map<string, unknown> }).presence;
    expect(presence.has("sess1")).toBe(false);
  });

  it("정지된 계정은 연결을 끊는다(세션 도중 정지되어도 즉시)", async () => {
    const { gw, accountAccess } = make();
    accountAccess.findActive.mockResolvedValueOnce(null);
    const client = socket();
    await gw.handleJoin(client as never, { sessionId: "sess1" });

    expect(client.disconnect).toHaveBeenCalled();
  });

  // 선택은 비공개다 — 상대에게 새어 나가면 "서로 골랐을 때만" 이라는 약속이 깨진다.
  it("choose 결과는 고른 사람에게만 에코된다", async () => {
    const { gw } = make();
    const chooser = socket("s1");
    const other = socket("s2");
    const presence = (gw as unknown as { presence: Map<string, Map<string, string>> }).presence;
    presence.set("sess1", new Map([["s1", "pa"], ["s2", "pd"]]));
    (gw as unknown as { server: { sockets: { sockets: Map<string, unknown> } } }).server.sockets.sockets =
      new Map<string, unknown>([["s1", chooser], ["s2", other]]);

    await gw.handleChoose(chooser as never, { sessionId: "sess1", targetProfileId: "pd", on: true });

    expect(chooser.emit).toHaveBeenCalledWith("speeddate:snapshot", expect.anything());
    expect(other.emit).not.toHaveBeenCalled();
  });

  it("거절된 choose는 에러만 돌려준다", async () => {
    const { gw } = make({ choose: null });
    const client = socket();
    await gw.handleChoose(client as never, { sessionId: "sess1", targetProfileId: "pd", on: true });

    expect(client.emit).toHaveBeenCalledWith("speeddate:error", { message: "선택할 수 없습니다" });
    expect(client.emit).not.toHaveBeenCalledWith("speeddate:snapshot", expect.anything());
  });

  it("라운드 중에만 LiveKit 토큰이 붙고, 카메라 권한은 서버가 정한다", async () => {
    const { gw, token } = make({ state: stateAt("round") });
    const client = socket();
    await gw.handleJoin(client as never, { sessionId: "sess1" });

    const [, event] = client.emit.mock.calls.find((c) => c[0] === "speeddate:snapshot") ?? [];
    expect(event.snapshot.room).toMatchObject({ token: "lk-token", url: "ws://lk" });
    // DISGUISED 스테이지이므로 영상 발행 불가로 발급되어야 한다.
    expect(token.mint).toHaveBeenCalledWith(
      "pa",
      expect.any(String),
      expect.objectContaining({ canPublishVideo: false }),
    );
  });

  it("라운드가 아니면 미디어 토큰을 발급하지 않는다", async () => {
    const { gw, token } = make({ state: stateAt("decision") });
    const client = socket();
    await gw.handleJoin(client as never, { sessionId: "sess1" });

    const [, event] = client.emit.mock.calls.find((c) => c[0] === "speeddate:snapshot") ?? [];
    expect(event.snapshot.room).toBeNull();
    expect(token.mint).not.toHaveBeenCalled();
  });

  it("사라진 세션은 snapshot:null로 알린다(클라가 탈출구를 띄운다)", async () => {
    const { gw } = make({ state: null });
    const client = socket();
    await gw.handleJoin(client as never, { sessionId: "gone" });

    expect(client.emit).toHaveBeenCalledWith("speeddate:snapshot", {
      sessionId: "gone",
      snapshot: null,
    });
  });

  it("연결이 끊기면 presence에서 지우고, 마지막 한 명이면 세션 항목도 지운다", async () => {
    const { gw } = make();
    const presence = (gw as unknown as { presence: Map<string, Map<string, string>> }).presence;
    presence.set("sess1", new Map([["s1", "pa"], ["s2", "pd"]]));

    gw.handleDisconnect(socket("s1") as never);
    expect(presence.get("sess1")?.has("s1")).toBe(false);

    gw.handleDisconnect(socket("s2") as never);
    expect(presence.has("sess1")).toBe(false);
  });

  it("스윕은 전이된 세션의 모든 소켓에 각자의 스냅샷을 보낸다", async () => {
    const { gw, sessions } = make();
    const a = socket("s1");
    const b = socket("s2");
    const presence = (gw as unknown as { presence: Map<string, Map<string, string>> }).presence;
    presence.set("sess1", new Map([["s1", "pa"], ["s2", "pd"]]));
    presence.set("sess2", new Map([["s3", "px"]]));
    (gw as unknown as { server: { sockets: { sockets: Map<string, unknown> } } }).server.sockets.sockets =
      new Map<string, unknown>([["s1", a], ["s2", b]]);
    sessions.advanceAllActive.mockResolvedValueOnce([
      { sessionId: "sess1", transitioned: true, state: stateAt("round") },
      { sessionId: "sess2", transitioned: false, state: stateAt("round") },
    ]);

    await (gw as unknown as { runSweep(): Promise<void> }).runSweep();

    expect(a.emit).toHaveBeenCalledWith("speeddate:snapshot", expect.anything());
    expect(b.emit).toHaveBeenCalledWith("speeddate:snapshot", expect.anything());
  });

  it("스윕은 겹쳐 돌지 않는다(느린 틱이 다음 틱과 뒤엉키지 않게)", async () => {
    const { gw, sessions } = make();
    let resolveFirst: (v: unknown) => void = () => {};
    sessions.advanceAllActive.mockReturnValueOnce(new Promise((r) => (resolveFirst = r)));

    const first = (gw as unknown as { runSweep(): Promise<void> }).runSweep();
    await (gw as unknown as { runSweep(): Promise<void> }).runSweep(); // 겹친 호출 — 그냥 반환해야 한다
    expect(sessions.advanceAllActive).toHaveBeenCalledTimes(1);

    resolveFirst([]);
    await first;
  });

  it("액션을 쏟아부으면 레이트리밋으로 막는다", async () => {
    const { gw, sessions } = make();
    const client = socket();
    for (let i = 0; i < 40; i++) await gw.handleSync(client as never, { sessionId: "sess1" });

    expect(client.emit).toHaveBeenCalledWith("speeddate:error", { message: "rate-limited" });
    // 30/10초 상한 — 그 뒤 호출은 세션 조회조차 하지 않는다.
    expect(sessions.loadState.mock.calls.length).toBeLessThanOrEqual(30);
  });

  it("sessionId 없는 이벤트는 forbidden", async () => {
    const { gw, sessions } = make();
    const client = socket();
    await gw.handleJoin(client as never, {});
    expect(client.emit).toHaveBeenCalledWith("speeddate:error", { message: "forbidden" });
    expect(sessions.assertParticipant).not.toHaveBeenCalled();
  });
});
