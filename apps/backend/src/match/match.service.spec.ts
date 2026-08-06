import { blockPairKey } from "@mingle/shared";
import { MatchService } from "./match.service";

const notify = { create: jest.fn().mockResolvedValue({}) } as any;

beforeEach(() => jest.clearAllMocks());

it("listMyMatches → hides a room whose peer is blocked", async () => {
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue({ id: "pa", userId: "ua" }) },
    match: {
      findMany: jest.fn().mockResolvedValue([
        { id: "m1", profileId1: "pa", profileId2: "pb", room: { id: "r1", messages: [] }, profile1: { id: "pa" }, profile2: { id: "pb", name: "B", age: 20, gender: "female", occupation: "x", photoUrl: null, preferenceSignals: null } },
      ]),
    },
    directMessage: { count: jest.fn().mockResolvedValue(0) },
  } as any;
  const blockedSafety = { blocksForProfiles: jest.fn().mockResolvedValue(new Set([blockPairKey("pa", "pb")])) } as any;
  const res = await new MatchService(prisma, notify, blockedSafety).listMyMatches("ua");
  expect(res).toHaveLength(0);
});
