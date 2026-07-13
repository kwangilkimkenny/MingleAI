import { AmongConfigProvider } from "./among.config";

function makeConfig(map: Record<string, string>) {
  return { get: (k: string) => map[k] } as any;
}

describe("AmongConfigProvider", () => {
  it("empty env → every default exactly", () => {
    const p = new AmongConfigProvider(makeConfig({}));
    expect(p.value).toEqual({
      minPlayers: 4,
      impostors: 1,
      tasksPerCrew: 3,
      killRange: 0.12,
      taskRange: 0.10,
      killCooldownMs: 20000,
      discussionMs: 30000,
      voteMs: 30000,
      emergencyPerPlayer: 1,
      sweepMs: 1000,
    });
  });

  it("AMONG_KILL_RANGE='5' → 0.12 (clamp out-of-range)", () => {
    const p = new AmongConfigProvider(makeConfig({ AMONG_KILL_RANGE: "5" }));
    expect(p.value.killRange).toBe(0.12);
  });

  it("AMONG_KILL_RANGE='0' → 0.12 (zero is invalid)", () => {
    const p = new AmongConfigProvider(makeConfig({ AMONG_KILL_RANGE: "0" }));
    expect(p.value.killRange).toBe(0.12);
  });

  it("AMONG_MIN_PLAYERS='1' → 4 (below min:2)", () => {
    const p = new AmongConfigProvider(makeConfig({ AMONG_MIN_PLAYERS: "1" }));
    expect(p.value.minPlayers).toBe(4);
  });

  it("AMONG_MIN_PLAYERS='abc' → 4 (non-integer)", () => {
    const p = new AmongConfigProvider(makeConfig({ AMONG_MIN_PLAYERS: "abc" }));
    expect(p.value.minPlayers).toBe(4);
  });

  it("AMONG_EMERGENCY_PER_PLAYER='0' → 0 (min:0 allowed)", () => {
    const p = new AmongConfigProvider(makeConfig({ AMONG_EMERGENCY_PER_PLAYER: "0" }));
    expect(p.value.emergencyPerPlayer).toBe(0);
  });

  it("AMONG_SWEEP_MS='100' → 1000 (below min:250)", () => {
    const p = new AmongConfigProvider(makeConfig({ AMONG_SWEEP_MS: "100" }));
    expect(p.value.sweepMs).toBe(1000);
  });

  it("AMONG_IMPOSTORS='2' → 2 (valid override)", () => {
    const p = new AmongConfigProvider(makeConfig({ AMONG_IMPOSTORS: "2" }));
    expect(p.value.impostors).toBe(2);
  });

  it("AMONG_KILL_RANGE='0.2' → 0.2 (valid override)", () => {
    const p = new AmongConfigProvider(makeConfig({ AMONG_KILL_RANGE: "0.2" }));
    expect(p.value.killRange).toBe(0.2);
  });
});
