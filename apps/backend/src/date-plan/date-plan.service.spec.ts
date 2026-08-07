import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
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
function make(
  over: { plan?: any; profile?: any; blocked?: boolean; plans?: any[]; naver?: any } = {},
) {
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
  const naver = {
    configured: over.naver?.configured ?? false,
    reverseArea: jest.fn().mockResolvedValue(over.naver?.area ?? null),
    searchLocal: jest.fn().mockResolvedValue(over.naver?.places ?? []),
  } as any;
  return { svc: new DatePlanService(prisma, safety, notifications, naver), prisma, safety, naver };
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

// Task 4 — select / confirm / cancel + notify
const COURSES = [{ courseId: "c1", label: "x", stops: [], totalEstimatedCost: 0, totalEstimatedMinutes: 0 }];

function makeWith(plan: any, profile: any) {
  const prisma = {
    match: { findUnique: jest.fn().mockResolvedValue(MATCH) },
    profile: { findUnique: jest.fn().mockResolvedValue(profile) },
    datePlan: {
      findUnique: jest.fn().mockResolvedValue(plan),
      update: jest.fn().mockImplementation(({ data }) => ({ ...plan, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as any;
  const safety = { isBlockedBetween: jest.fn().mockResolvedValue(false) } as any;
  const notifications = { create: jest.fn().mockResolvedValue({}) } as any;
  const naver = { configured: false, reverseArea: jest.fn(), searchLocal: jest.fn() } as any;
  return { svc: new DatePlanService(prisma, safety, notifications, naver), prisma, notifications };
}

it("select: creator sets a valid course + notifies the peer", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: null, confirmedAt: null, createdAt: new Date() };
  const { svc, notifications } = makeWith(plan, { id: "pA", userId: "uA" });
  const view = await svc.select("uA", "d1", "c1");
  expect(view.selectedCourseId).toBe("c1");
  expect(notifications.create).toHaveBeenCalled();
});

it("select: rejects a non-creator", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: null, confirmedAt: null, createdAt: new Date() };
  const { svc } = makeWith(plan, { id: "pB", userId: "uB" });
  await expect(svc.select("uB", "d1", "c1")).rejects.toBeInstanceOf(ForbiddenException);
});

it("select: rejects an unknown courseId", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: null, confirmedAt: null, createdAt: new Date() };
  const { svc } = makeWith(plan, { id: "pA", userId: "uA" });
  await expect(svc.select("uA", "d1", "zzz")).rejects.toBeInstanceOf(BadRequestException);
});

it("confirm: peer confirms draft→confirmed + notifies creator", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: "c1", confirmedAt: null, createdAt: new Date() };
  const { svc, prisma, notifications } = makeWith(plan, { id: "pB", userId: "uB" });
  prisma.datePlan.findUnique.mockResolvedValueOnce(plan).mockResolvedValueOnce({ ...plan, status: "confirmed", confirmedAt: new Date() });
  const view = await svc.confirm("uB", "d1");
  expect(prisma.datePlan.updateMany).toHaveBeenCalledWith({ where: { id: "d1", status: "draft" }, data: expect.objectContaining({ status: "confirmed" }) });
  expect(view.status).toBe("confirmed");
  expect(notifications.create).toHaveBeenCalled();
});

it("confirm: creator cannot self-confirm", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: "c1", confirmedAt: null, createdAt: new Date() };
  const { svc } = makeWith(plan, { id: "pA", userId: "uA" });
  await expect(svc.confirm("uA", "d1")).rejects.toBeInstanceOf(ForbiddenException);
});

it("confirm: double-confirm is idempotent (count 0 but already confirmed)", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: "c1", confirmedAt: null, createdAt: new Date() };
  const { svc, prisma } = makeWith(plan, { id: "pB", userId: "uB" });
  prisma.datePlan.updateMany.mockResolvedValueOnce({ count: 0 });
  prisma.datePlan.findUnique.mockResolvedValueOnce(plan).mockResolvedValueOnce({ ...plan, status: "confirmed", confirmedAt: new Date() });
  const view = await svc.confirm("uB", "d1");
  expect(view.status).toBe("confirmed");
});

it("confirm: still returns the row when notify throws (non-fatal)", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: "c1", confirmedAt: null, createdAt: new Date() };
  const { svc, prisma, notifications } = makeWith(plan, { id: "pB", userId: "uB" });
  notifications.create.mockRejectedValue(new Error("down"));
  prisma.datePlan.findUnique.mockResolvedValueOnce(plan).mockResolvedValueOnce({ ...plan, status: "confirmed", confirmedAt: new Date() });
  await expect(svc.confirm("uB", "d1")).resolves.toHaveProperty("status", "confirmed");
});

it("cancel: a member cancels → cancelled", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: null, confirmedAt: null, createdAt: new Date() };
  const { svc } = makeWith(plan, { id: "pB", userId: "uB" });
  const view = await svc.cancel("uB", "d1");
  expect(view.status).toBe("cancelled");
});

describe("실제 장소 붙이기", () => {
  const naverPlace = (title: string) => ({
    title,
    category: "음식점>카페",
    address: "서울 중구 세종대로 1",
    roadAddress: "서울 중구 세종대로 1",
    telephone: "",
    link: "",
    mapx: "1269700000",
    mapy: "375600000",
  });

  const dto = {
    matchId: "m1",
    budget: { total: 200000 },
    location: { city: "서울", lat: 37.56, lng: 126.97 },
    dateTime: { preferredDate: "2026-08-20" },
  } as any;

  it("좌표를 주면 코스 칸이 그 동네의 실제 가게로 채워진다", async () => {
    const { svc, naver, prisma } = make({
      naver: {
        configured: true,
        area: "태평로1가",
        places: [naverPlace("센터커피"), naverPlace("스타벅스")],
      },
    });
    await svc.create("uA", dto);
    const created = prisma.datePlan.create.mock.calls[0][0].data;
    const stops = created.courses.flatMap((c: any) => c.stops);
    expect(stops.some((s: any) => s.place)).toBe(true);
    const withPlace = stops.find((s: any) => s.place);
    expect(withPlace.name).toBe(withPlace.place.name);
    expect(withPlace.place.mapUrl).toContain("map.naver.com");
    // 검색어에 역지오코딩한 동네가 붙어야 '내 주변'이 된다.
    expect(String(naver.searchLocal.mock.calls[0][0])).toContain("태평로1가");
  });

  it("좌표가 없으면 검색하지 않고 유형 예시 이름을 그대로 둔다", async () => {
    const { svc, naver, prisma } = make({ naver: { configured: true, places: [naverPlace("센터커피")] } });
    await svc.create("uA", { ...dto, location: { city: "서울" } });
    expect(naver.searchLocal).not.toHaveBeenCalled();
    const stops = prisma.datePlan.create.mock.calls[0][0].data.courses.flatMap((c: any) => c.stops);
    expect(stops.every((s: any) => !s.place)).toBe(true);
  });

  it("네이버가 죽어도 플랜은 만들어진다", async () => {
    const { svc, prisma, naver } = make({ naver: { configured: true, area: "강남구", places: [] } });
    naver.searchLocal.mockRejectedValue(new Error("naver down"));
    await expect(svc.create("uA", dto)).resolves.toBeDefined();
    const stops = prisma.datePlan.create.mock.calls[0][0].data.courses.flatMap((c: any) => c.stops);
    expect(stops.length).toBeGreaterThan(0);
    expect(stops.every((s: any) => !s.place)).toBe(true);
  });

  it("같은 유형이 여러 코스에 있어도 서로 다른 가게가 걸린다", async () => {
    const { svc, prisma } = make({
      naver: {
        configured: true,
        area: "서초동",
        places: [naverPlace("가게A"), naverPlace("가게B"), naverPlace("가게C")],
      },
    });
    await svc.create("uA", dto);
    const cafes = prisma.datePlan.create.mock.calls[0][0].data.courses
      .flatMap((c: any) => c.stops)
      .filter((s: any) => s.type === "cafe" && s.place);
    expect(cafes.length).toBeGreaterThan(1);
    expect(new Set(cafes.map((s: any) => s.place.name)).size).toBeGreaterThan(1);
  });
});

it("한 코스 안에서 같은 가게가 두 번 나오지 않는다", async () => {
  const place = (title: string) => ({
    title,
    category: "음식점",
    address: "서울 성동구 연무장길 1",
    roadAddress: "서울 성동구 연무장길 1",
    telephone: "",
    link: "",
    mapx: "1270557000",
    mapy: "375445000",
  });
  // 카페 검색과 맛집 검색이 같은 가게를 돌려주는 상황(실제로 관측됨).
  const { svc, prisma } = make({
    naver: { configured: true, area: "성수동", places: [place("성수율 카페"), place("다른 가게")] },
  });
  await svc.create("uA", {
    matchId: "m1",
    budget: { total: 200000 },
    location: { city: "성수동", lat: 37.5445, lng: 127.0557 },
    dateTime: { preferredDate: "2026-08-15" },
  } as any);
  for (const course of prisma.datePlan.create.mock.calls[0][0].data.courses) {
    const named = course.stops.filter((s: any) => s.place).map((s: any) => s.place.name);
    expect(new Set(named).size).toBe(named.length);
  }
});

describe("한 매치에 살아 있는 플랜은 하나", () => {
  const dto = {
    matchId: "m1",
    budget: { total: 150000 },
    location: { city: "성수동" },
    dateTime: { preferredDate: "2026-08-20" },
  } as any;

  it("이전 draft는 정리하고 새 플랜을 만든다(다시 추천받기)", async () => {
    const { svc, prisma } = make();
    prisma.datePlan.findMany = jest.fn().mockResolvedValue([{ id: "old", status: "draft" }]);
    prisma.datePlan.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    await svc.create("uA", dto);
    expect(prisma.datePlan.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["old"] } },
      data: { status: "cancelled" },
    });
    expect(prisma.datePlan.create).toHaveBeenCalled();
  });

  it("확정된 계획이 있으면 새로 만들지 못한다", async () => {
    const { svc, prisma } = make();
    prisma.datePlan.findMany = jest.fn().mockResolvedValue([{ id: "c1", status: "confirmed" }]);
    await expect(svc.create("uA", dto)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.datePlan.create).not.toHaveBeenCalled();
  });
});
