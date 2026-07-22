import { STAGE_ORDER_FULL, type SpeedDateConfig } from "./speed-date.config";
import {
  createInitialState,
  nextPhase,
  snapshotFor,
  metPartnerIds,
  mutualPairs,
  type SpeedDateParticipant,
  type SpeedDateState,
} from "./speed-date.state";

function cfg(stages: number): SpeedDateConfig {
  return {
    stages,
    stageOrder: STAGE_ORDER_FULL.slice(-stages),
    groupPerGender: 3,
    preflightMs: 1000,
    roundMs: 3000,
    intermissionMs: 500,
    decisionMs: 1000,
    sweepMs: 2500,
    maxWaitMs: 120000,
    baseThreshold: 0.4,
    aiFill: false,
    livekit: { url: "", apiKey: "", apiSecret: "" },
  };
}

const males = ["m0", "m1", "m2"];
const females = ["f0", "f1", "f2"];
const participants: SpeedDateParticipant[] = [...males, ...females].map((id, i) => ({
  profileId: id,
  gender: i < 3 ? "male" : "female",
  nickname: `nick-${id}`,
  avatarId: `av-${id}`,
  isAi: false,
}));

function makeState(stages: number, now = 0): SpeedDateState {
  return createInitialState(participants, males, females, cfg(stages), now);
}

/** Drive the state machine forward one transition at its deadline. */
function tick(state: SpeedDateState, c: SpeedDateConfig): SpeedDateState {
  const next = nextPhase(state, state.phaseEndsAt, c);
  if (!next) throw new Error("no transition");
  return next;
}

describe("createInitialState", () => {
  it("starts in preflight with a full rotation schedule", () => {
    const s = makeState(1, 100);
    expect(s.phase).toBe("preflight");
    expect(s.phaseEndsAt).toBe(100 + 1000);
    expect(s.stageOrder).toEqual(["FACE"]);
    expect(s.schedule).toHaveLength(3);
    expect(s.sequence).toBe(0);
  });
});

describe("nextPhase — slice (1 stage = FACE)", () => {
  const c = cfg(1);

  it("walks preflight → 3 rounds w/ intermissions → decision → ended", () => {
    let s = makeState(1, 0);
    const seen: string[] = [s.phase];
    for (let i = 0; i < 8 && s.phase !== "ended"; i++) {
      s = tick(s, c);
      seen.push(`${s.phase}:${s.stageIndex}:${s.roundIndex}`);
    }
    expect(seen).toEqual([
      "preflight",
      "round:0:0",
      "intermission:0:0",
      "round:0:1",
      "intermission:0:1",
      "round:0:2",
      "decision:0:2",
      "ended:0:2",
    ]);
  });

  it("increments sequence on every transition", () => {
    let s = makeState(1, 0);
    const first = s.sequence;
    s = tick(s, c);
    expect(s.sequence).toBe(first + 1);
  });

  it("returns null before the deadline and once ended", () => {
    const s = makeState(1, 0);
    expect(nextPhase(s, s.phaseEndsAt - 1, c)).toBeNull();
    let end = s;
    while (end.phase !== "ended") end = tick(end, c);
    expect(nextPhase(end, end.phaseEndsAt + 10_000, c)).toBeNull();
  });
});

describe("nextPhase — full (3 stages)", () => {
  const c = cfg(3);

  it("only the final round of the final stage goes to decision", () => {
    let s = makeState(3, 0);
    const rounds: string[] = [];
    let decisions = 0;
    for (let i = 0; i < 40 && s.phase !== "ended"; i++) {
      s = tick(s, c);
      if (s.phase === "round") rounds.push(`${s.stageIndex}:${s.roundIndex}`);
      if (s.phase === "decision") decisions++;
    }
    // 3 stages × 3 rounds, each stage visits rounds 0,1,2
    expect(rounds).toEqual([
      "0:0", "0:1", "0:2",
      "1:0", "1:1", "1:2",
      "2:0", "2:1", "2:2",
    ]);
    expect(decisions).toBe(1);
    expect(s.stageOrder).toEqual(["DISGUISED", "VOICE", "FACE"]);
  });
});

describe("metPartnerIds", () => {
  it("is empty during preflight and grows as rounds complete", () => {
    const c = cfg(1);
    let s = makeState(1, 0);
    expect(metPartnerIds(s, "m0")).toEqual([]);
    s = tick(s, c); // round 0: m0-f0
    expect(metPartnerIds(s, "m0")).toEqual(["f0"]);
    s = tick(s, c); // intermission
    s = tick(s, c); // round 1: m0-f1
    expect(new Set(metPartnerIds(s, "m0"))).toEqual(new Set(["f0", "f1"]));
    while (s.phase !== "ended") s = tick(s, c);
    expect(new Set(metPartnerIds(s, "m0"))).toEqual(new Set(["f0", "f1", "f2"]));
  });
});

describe("snapshotFor", () => {
  const c = cfg(1);

  it("shows the live partner only during a round, redacted for the FACE stage", () => {
    let s = makeState(1, 0);
    expect(snapshotFor("sess", s, "m0").partner).toBeNull(); // preflight
    s = tick(s, c); // round 0: m0-f0, stage FACE
    const snap = snapshotFor("sess", s, "m0");
    expect(snap.stage).toBe("FACE");
    expect(snap.partner).toMatchObject({ profileId: "f0", nickname: "nick-f0", video: true });
    expect(snap.partner).not.toHaveProperty("name");
  });

  it("exposes only the viewer's own choices and results", () => {
    let s = makeState(1, 0);
    s.choices = { m0: ["f1"], f1: ["m0"] };
    expect(snapshotFor("sess", s, "m0").myChoices).toEqual(["f1"]);
    expect(snapshotFor("sess", s, "m1").myChoices).toEqual([]);
    while (s.phase !== "ended") s = tick(s, c);
    s.result = { matches: [{ a: "m0", b: "f1", matchId: "match1", roomId: "room1" }] };
    expect(snapshotFor("sess", s, "m0").result?.matches).toEqual([
      { profileId: "f1", nickname: "nick-f1", roomId: "room1" },
    ]);
    expect(snapshotFor("sess", s, "m2").result?.matches).toEqual([]);
  });
});

describe("mutualPairs", () => {
  it("returns only pairs where both chose each other", () => {
    const s = makeState(1, 0);
    s.choices = {
      m0: ["f0", "f1"],
      f0: ["m0"], // mutual with m0
      f1: ["m2"], // not mutual with m0
      m2: ["f1"], // one-directional? f1 chose m2 too → mutual
    };
    const pairs = mutualPairs(s).map(([a, b]) => `${a}-${b}`).sort();
    expect(pairs).toEqual(["m0-f0", "m2-f1"].sort());
  });
});
