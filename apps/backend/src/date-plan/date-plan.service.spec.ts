import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { DatePlanService } from "./date-plan.service";

const MATCH = { id: "m1", profileId1: "pA", profileId2: "pB" };
const DEFAULT_PLAN = {
  id: "d1",
  matchId: "m1",
  creatorProfileId: "pA",
  status: "draft",
  courses: [],
  selectedCourseId: null,
  confirmedAt: null,
  createdAt: new Date(),
};
function make(over: { plan?: any; profile?: any; blocked?: boolean; plans?: any[] } = {}) {
  const prisma = {
    match: { findUnique: jest.fn().mockResolvedValue(MATCH) },
    profile: { findUnique: jest.fn().mockResolvedValue(over.profile ?? { id: "pA", userId: "uA" }) },
    datePlan: {
      findUnique: jest.fn().mockResolvedValue(over.plan ?? DEFAULT_PLAN),
      findMany: jest.fn().mockResolvedValue(over.plans ?? []),
      create: jest.fn().mockImplementation(({ data }) => ({ id: "d1", ...data, createdAt: new Date() })),
    },
  } as any;
  const safety = { isBlockedBetween: jest.fn().mockResolvedValue(over.blocked ?? false) } as any;
  const notifications = { create: jest.fn().mockResolvedValue({}) } as any;
  return { svc: new DatePlanService(prisma, safety, notifications), prisma, safety };
}

it("memberContext resolves member + peer", async () => {
  const { svc } = make({ profile: { id: "pA", userId: "uA" } });
  const ctx = await svc.memberContext("uA", "d1");
  expect(ctx.myProfileId).toBe("pA");
  expect(ctx.peerProfileId).toBe("pB");
});

it("memberContext 403 for a non-member", async () => {
  const { svc } = make({ profile: { id: "pX", userId: "uX" } });
  await expect(svc.memberContext("uX", "d1")).rejects.toBeInstanceOf(ForbiddenException);
});

it("memberContext 403 when blocked", async () => {
  const { svc } = make({ blocked: true });
  await expect(svc.memberContext("uA", "d1")).rejects.toBeInstanceOf(ForbiddenException);
});

it("create sets creatorProfileId + guards a missing match", async () => {
  const { svc, prisma } = make();
  const dto = { matchId: "m1", budget: { total: 100000 }, location: { city: "서울" }, dateTime: { preferredDate: "2026-08-01" } };
  const plan = await svc.create("uA", dto as any);
  expect(plan.creatorProfileId).toBe("pA");
  prisma.match.findUnique.mockResolvedValueOnce(null);
  await expect(svc.create("uA", dto as any)).rejects.toBeInstanceOf(NotFoundException);
});

it("getOne returns a view without payment fields", async () => {
  const { svc } = make();
  const view = await svc.getOne("uA", "d1");
  expect(view).not.toHaveProperty("merchantPayKey");
  expect(view).toHaveProperty("status", "draft");
});

// M2 — listForMatch tests
it("listForMatch returns views for a member", async () => {
  const now = new Date();
  const { svc } = make({
    plans: [
      { ...DEFAULT_PLAN, id: "d1", createdAt: now },
      { ...DEFAULT_PLAN, id: "d2", createdAt: now },
    ],
  });
  const views = await svc.listForMatch("uA", "m1");
  expect(views).toHaveLength(2);
  expect(views[0]).toHaveProperty("status", "draft");
});

it("listForMatch 403 for a non-member", async () => {
  const { svc } = make({ profile: { id: "pX", userId: "uX" } });
  await expect(svc.listForMatch("uX", "m1")).rejects.toBeInstanceOf(ForbiddenException);
});

it("listForMatch 403 when blocked", async () => {
  const { svc } = make({ blocked: true });
  await expect(svc.listForMatch("uA", "m1")).rejects.toBeInstanceOf(ForbiddenException);
});

// M3 — create authz-path tests
it("create 403 when caller's profile is not in the match", async () => {
  const { svc } = make({ profile: { id: "pX", userId: "uX" } });
  const dto = { matchId: "m1", budget: { total: 100000 }, location: { city: "서울" }, dateTime: { preferredDate: "2026-08-01" } };
  await expect(svc.create("uX", dto as any)).rejects.toBeInstanceOf(ForbiddenException);
});

it("create 403 when blocked", async () => {
  const { svc } = make({ blocked: true });
  const dto = { matchId: "m1", budget: { total: 100000 }, location: { city: "서울" }, dateTime: { preferredDate: "2026-08-01" } };
  await expect(svc.create("uA", dto as any)).rejects.toBeInstanceOf(ForbiddenException);
});

// M4 — listForMatch 400 on missing matchId
it("listForMatch 400 when matchId is empty", async () => {
  const { svc } = make();
  await expect(svc.listForMatch("uA", "")).rejects.toBeInstanceOf(BadRequestException);
});
