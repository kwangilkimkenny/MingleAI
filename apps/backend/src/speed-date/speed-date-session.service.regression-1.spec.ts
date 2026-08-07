import { buildRotationSchedule } from "@mingle/shared";
import { SpeedDateConfigProvider, STAGE_ORDER_FULL, type SpeedDateConfig } from "./speed-date.config";
import { SpeedDateSessionService } from "./speed-date-session.service";
import type { SpeedDateParticipant, SpeedDateState } from "./speed-date.state";

// Regression: ISSUE-003 — session claim, membership, and batch-advance error paths lacked coverage
// Found by /qa on 2026-08-07
// Report: .gstack/qa-reports/release-readiness-qa-2026-08-07.md
describe("SpeedDateSessionService release paths", () => {
  const config: SpeedDateConfig = {
    stages: 1,
    stageOrder: STAGE_ORDER_FULL.slice(-1),
    groupPerGender: 3,
    preflightMs: 1000,
    stageIntroMs: 500,
    roundMs: 3000,
    intermissionMs: 500,
    decisionMs: 1000,
    sweepMs: 2500,
    maxWaitMs: 120000,
    baseThreshold: 0.4,
    aiFill: false,
    livekit: { url: "", apiKey: "", apiSecret: "" },
  };
  const ids = ["m1", "m2", "m3", "f1", "f2", "f3"];
  const participants: SpeedDateParticipant[] = ids.map((profileId, index) => ({
    profileId,
    gender: index < 3 ? "male" : "female",
    nickname: profileId,
    avatarId: "avatar",
    isAi: false,
  }));

  function service(prisma: any, match: any = {}) {
    return new SpeedDateSessionService(
      prisma,
      { value: config } as SpeedDateConfigProvider,
      match,
    );
  }

  function activeState(): SpeedDateState {
    return {
      phase: "round",
      stageIndex: 0,
      roundIndex: 0,
      phaseEndsAt: 1000,
      sequence: 1,
      stageOrder: ["FACE"],
      participants,
      males: ids.slice(0, 3),
      females: ids.slice(3),
      schedule: buildRotationSchedule(ids.slice(0, 3), ids.slice(3)),
      choices: {},
    };
  }

  it("loads state and returns null for a missing session", async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ state: activeState() })
      .mockResolvedValueOnce(null);
    const subject = service({ speedDateSession: { findUnique } } as any);
    await expect(subject.loadState("s1")).resolves.toEqual(activeState());
    await expect(subject.loadState("missing")).resolves.toBeNull();
  });

  it("asserts membership using the caller profile", async () => {
    const prisma = {
      profile: { findUnique: jest.fn().mockResolvedValue({ id: "m1" }) },
      speedDateSession: { findUnique: jest.fn().mockResolvedValue({ state: activeState() }) },
    } as any;
    await expect(service(prisma).assertParticipant("u1", "s1")).resolves.toBe("m1");
    prisma.profile.findUnique.mockResolvedValueOnce(null);
    await expect(service(prisma).assertParticipant("missing", "s1")).resolves.toBeNull();
  });

  it("atomically claims queue entries and links them to the new session", async () => {
    const tx = {
      speedDateQueueEntry: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      speedDateSession: { create: jest.fn().mockResolvedValue({ id: "session-1" }) },
    };
    const prisma = { $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) } as any;

    await expect(
      service(prisma).createSession(["q1", "q2"], participants, ids.slice(0, 3), ids.slice(3), new Date(0)),
    ).resolves.toBe("session-1");
    expect(tx.speedDateQueueEntry.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: ["q1", "q2"] } },
      data: { matchedSessionId: "session-1" },
    });
  });

  it("rolls back cleanly when another sweep already claimed an entry", async () => {
    const tx = {
      speedDateQueueEntry: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      speedDateSession: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) } as any;
    await expect(
      service(prisma).createSession(["q1"], participants, ids.slice(0, 3), ids.slice(3), new Date(0)),
    ).resolves.toBeNull();
    expect(tx.speedDateSession.create).not.toHaveBeenCalled();
  });

  it("continues advancing healthy sessions when one session fails", async () => {
    const prisma = {
      speedDateSession: {
        findMany: jest.fn().mockResolvedValue([{ id: "bad" }, { id: "good" }]),
      },
    } as any;
    const subject = service(prisma);
    jest
      .spyOn(subject, "advance")
      .mockRejectedValueOnce(new Error("broken state"))
      .mockResolvedValueOnce({ sessionId: "good", transitioned: false, state: activeState() });

    await expect(subject.advanceAllActive(new Date(0))).resolves.toEqual([
      { sessionId: "good", transitioned: false, state: activeState() },
    ]);
  });
});
