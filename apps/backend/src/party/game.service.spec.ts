import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { GameService, QUESTIONS, TOTAL_ROUNDS } from "./game.service";

const prisma = {
  gameSession: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
} as any;

const service = new GameService(prisma);
beforeEach(() => jest.clearAllMocks());

function stateWith(partial: Partial<{ order: number[]; round: number; votes: any; reveals: any[] }>) {
  return { order: [0, 1, 2, 3, 4], round: 0, votes: {}, reveals: [], ...partial };
}
const ROW = (state: any, status = "active") => ({ id: "g1", partyId: "pt1", gameType: "balance", status, state });

describe("start", () => {
  it("creates a 5-round session and returns the first-question snapshot", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(null);
    prisma.gameSession.create.mockImplementation(async ({ data }: any) => ({ id: "g1", ...data }));
    const snap = await service.start("pt1");
    expect(prisma.gameSession.create).toHaveBeenCalled();
    const created = prisma.gameSession.create.mock.calls[0][0].data;
    expect(created.status).toBe("active");
    expect(created.state.order).toHaveLength(TOTAL_ROUNDS);
    expect(new Set(created.state.order).size).toBe(TOTAL_ROUNDS);
    expect(snap.status).toBe("active");
    expect(snap.round).toBe(0);
    expect(snap.totalRounds).toBe(TOTAL_ROUNDS);
    expect(snap.question).toEqual(QUESTIONS[created.state.order[0]]);
    expect(snap.votedProfileIds).toEqual([]);
  });
  it("rejects when a session is already active", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(ROW(stateWith({})));
    await expect(service.start("pt1")).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("vote", () => {
  it("records a hidden vote (ids only) without advancing when others haven't voted", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(ROW(stateWith({})));
    prisma.gameSession.update.mockResolvedValue({});
    const snap = await service.vote("pt1", "pfA", "a", ["pfA", "pfB"]);
    expect(snap.round).toBe(0);
    expect(snap.votedProfileIds).toEqual(["pfA"]);
    expect(snap.reveals).toEqual([]);
    expect((snap as any).votes).toBeUndefined();
  });
  it("overwrites a re-vote", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(
      ROW(stateWith({ votes: { "0": { pfA: "a" } } })),
    );
    prisma.gameSession.update.mockResolvedValue({});
    const snap = await service.vote("pt1", "pfA", "b", ["pfA", "pfB"]);
    expect(snap.votedProfileIds).toEqual(["pfA"]);
    expect(snap.round).toBe(0);
  });
  it("reveals and advances when every present member has voted", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(
      ROW(stateWith({ votes: { "0": { pfA: "a" } } })),
    );
    prisma.gameSession.update.mockResolvedValue({});
    const snap = await service.vote("pt1", "pfB", "b", ["pfA", "pfB"]);
    expect(snap.round).toBe(1);
    expect(snap.reveals).toHaveLength(1);
    expect(snap.reveals[0]).toEqual({
      round: 0,
      question: QUESTIONS[0],
      aVoters: ["pfA"],
      bVoters: ["pfB"],
    });
    expect(snap.question).toEqual(QUESTIONS[1]);
    expect(snap.votedProfileIds).toEqual([]);
  });
  it("ends the game after the final round reveals", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(
      ROW(stateWith({ round: TOTAL_ROUNDS - 1, votes: { "4": { pfA: "a" } } })),
    );
    prisma.gameSession.update.mockResolvedValue({});
    const snap = await service.vote("pt1", "pfB", "a", ["pfA", "pfB"]);
    expect(snap.status).toBe("ended");
    expect(snap.question).toBeNull();
    const update = prisma.gameSession.update.mock.calls[0][0].data;
    expect(update.status).toBe("ended");
    expect(update.result).toHaveLength(1);
  });
  it("rejects a bad choice", async () => {
    await expect(service.vote("pt1", "pfA", "x" as any, ["pfA"])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it("rejects when no game is active", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(null);
    await expect(service.vote("pt1", "pfA", "a", ["pfA"])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("end / current", () => {
  it("force-ends the active game keeping completed reveals", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(
      ROW(stateWith({ round: 2, reveals: [{ round: 0 }, { round: 1 }] as any })),
    );
    prisma.gameSession.update.mockResolvedValue({});
    const snap = await service.end("pt1");
    expect(snap.status).toBe("ended");
    expect(snap.reveals).toHaveLength(2);
    expect(snap.question).toBeNull();
  });
  it("end rejects when none active", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(null);
    await expect(service.end("pt1")).rejects.toBeInstanceOf(NotFoundException);
  });
  it("current returns the active snapshot or null", async () => {
    prisma.gameSession.findFirst.mockResolvedValueOnce(ROW(stateWith({})));
    await expect(service.current("pt1")).resolves.toMatchObject({ sessionId: "g1", round: 0 });
    prisma.gameSession.findFirst.mockResolvedValueOnce(null);
    await expect(service.current("pt1")).resolves.toBeNull();
  });
});
