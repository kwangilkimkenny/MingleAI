import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { SafetyService } from "../safety/safety.service";
import { NotificationService } from "../notification/notification.service";
import { CreateDatePlanDto } from "./dto/create-date-plan.dto";
import type { DateCourse, DateStop, DateStopPlace, DateConstraints, DatePlanView } from "@mingle/shared";
import { NaverSearchService, type NaverPlace } from "../naver/naver-search.service";

interface VenueTemplate {
  type: string;
  names: string[];
  avgCostKRW: number;
  avgMinutes: number;
}

const VENUE_TEMPLATES: VenueTemplate[] = [
  { type: "cafe", names: ["아늑한 카페", "루프탑 카페", "브런치 카페", "디저트 카페"], avgCostKRW: 15000, avgMinutes: 40 },
  { type: "restaurant", names: ["이탈리안 레스토랑", "한식당", "일식당", "프렌치 비스트로", "태국 레스토랑"], avgCostKRW: 40000, avgMinutes: 60 },
  { type: "walk", names: ["한강 산책", "공원 산책", "고궁 산책", "숲길 산책"], avgCostKRW: 0, avgMinutes: 30 },
  { type: "museum", names: ["미술관 관람", "전시회 방문", "갤러리 투어"], avgCostKRW: 15000, avgMinutes: 60 },
  { type: "movie", names: ["영화 관람"], avgCostKRW: 28000, avgMinutes: 120 },
  { type: "concert", names: ["공연 관람", "라이브 카페"], avgCostKRW: 50000, avgMinutes: 90 },
  { type: "activity", names: ["방탈출", "볼링", "보드게임 카페", "쿠킹 클래스"], avgCostKRW: 25000, avgMinutes: 60 },
  { type: "bar", names: ["와인바", "칵테일바", "크래프트 비어바"], avgCostKRW: 30000, avgMinutes: 50 },
];

const COURSE_THEMES = [
  { label: "편안하고 따뜻한 데이트", types: ["cafe", "walk", "restaurant"] },
  { label: "문화와 미식의 만남", types: ["museum", "cafe", "restaurant"] },
  { label: "액티브 & 펀 데이트", types: ["activity", "restaurant", "bar"] },
];

/** 코스 유형 → 네이버 지역검색어. 유형별로 한 번만 검색해 코스들이 나눠 쓴다. */
const SEARCH_TERMS: Record<string, string> = {
  cafe: "카페",
  restaurant: "맛집",
  walk: "공원",
  museum: "미술관",
  movie: "영화관",
  concert: "공연장",
  activity: "보드게임 카페",
  bar: "와인바",
};

const RATIONALE_MAP: Record<string, string> = {
  cafe: "편안한 분위기에서 대화를 시작하기 좋습니다",
  restaurant: "함께 맛있는 식사를 즐기며 친밀감을 높일 수 있습니다",
  walk: "자연스러운 분위기에서 깊은 대화를 나눌 수 있습니다",
  museum: "문화적 경험을 공유하며 서로의 취향을 알 수 있습니다",
  movie: "함께 감상 경험을 공유할 수 있습니다",
  concert: "음악을 통한 감정 공유가 가능합니다",
  activity: "함께 활동하며 자연스럽게 팀워크를 경험할 수 있습니다",
  bar: "편안한 분위기에서 하루를 마무리할 수 있습니다",
};

@Injectable()
export class DatePlanService {
  private readonly log = new Logger(DatePlanService.name);
  constructor(
    private prisma: PrismaService,
    private readonly safety: SafetyService,
    private readonly notifications: NotificationService,
    private readonly naver: NaverSearchService,
  ) {}

  toView(plan: {
    id: string;
    matchId: string;
    creatorProfileId: string | null;
    constraints: unknown;
    courses: unknown;
    status: string;
    selectedCourseId: string | null;
    confirmedAt: Date | null;
    completedAt?: Date | null;
    createdAt: Date;
  }): DatePlanView {
    return {
      id: plan.id,
      matchId: plan.matchId,
      creatorProfileId: plan.creatorProfileId ?? null,
      constraints: plan.constraints as DateConstraints,
      courses: plan.courses as DateCourse[],
      status: plan.status as DatePlanView["status"],
      selectedCourseId: plan.selectedCourseId ?? null,
      confirmedAt: plan.confirmedAt ? plan.confirmedAt.toISOString() : null,
      completedAt: plan.completedAt ? plan.completedAt.toISOString() : null,
      createdAt: plan.createdAt.toISOString(),
    };
  }

  async memberContext(userId: string, datePlanId: string) {
    const plan = await this.prisma.datePlan.findUnique({ where: { id: datePlanId } });
    if (!plan) throw new NotFoundException(`데이트 플랜을 찾을 수 없습니다: ${datePlanId}`);
    const match = await this.prisma.match.findUnique({ where: { id: plan.matchId } });
    if (!match) throw new NotFoundException("매치를 찾을 수 없습니다");
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me || (me.id !== match.profileId1 && me.id !== match.profileId2)) {
      throw new ForbiddenException("이 데이트 플랜에 접근할 수 없습니다");
    }
    if (await this.safety.isBlockedBetween(match.profileId1, match.profileId2)) {
      throw new ForbiddenException("차단된 상대와는 데이트 플랜을 진행할 수 없습니다");
    }
    const peerProfileId = me.id === match.profileId1 ? match.profileId2 : match.profileId1;
    return { plan, match, myProfileId: me.id, peerProfileId };
  }

  async getOne(userId: string, id: string): Promise<DatePlanView> {
    const { plan } = await this.memberContext(userId, id);
    return this.toView(plan);
  }

  async listForMatch(userId: string, matchId: string): Promise<DatePlanView[]> {
    if (!matchId) throw new BadRequestException("matchId가 필요합니다");
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException("매치를 찾을 수 없습니다");
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me || (me.id !== match.profileId1 && me.id !== match.profileId2)) {
      throw new ForbiddenException("이 매치에 접근할 수 없습니다");
    }
    if (await this.safety.isBlockedBetween(match.profileId1, match.profileId2)) {
      throw new ForbiddenException("차단된 상대입니다");
    }
    const plans = await this.prisma.datePlan.findMany({
      where: { matchId },
      orderBy: { createdAt: "desc" },
    });
    return plans.map((p) => this.toView(p));
  }

  async create(userId: string, dto: CreateDatePlanDto) {
    const match = await this.prisma.match.findUnique({ where: { id: dto.matchId } });
    if (!match) throw new NotFoundException(`매치를 찾을 수 없습니다: ${dto.matchId}`);
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me || (me.id !== match.profileId1 && me.id !== match.profileId2)) {
      throw new ForbiddenException("이 매치의 참여자만 데이트 플랜을 만들 수 있습니다");
    }
    if (await this.safety.isBlockedBetween(match.profileId1, match.profileId2)) {
      throw new ForbiddenException("차단된 상대와는 데이트 플랜을 만들 수 없습니다");
    }

    // 한 매치에 살아 있는 플랜은 하나만 둔다. 확정·완료된 계획은 함부로 지울 수 없고(상대와
    // 합의된 약속이다), 아직 draft인 것은 "다시 추천받기"로 보고 조용히 정리한다.
    const live = await this.prisma.datePlan.findMany({
      where: { matchId: dto.matchId, status: { in: ["draft", "confirmed"] } },
      select: { id: true, status: true },
    });
    if (live.some((p) => p.status === "confirmed")) {
      throw new ConflictException("이미 확정된 데이트 계획이 있습니다");
    }
    if (live.length > 0) {
      await this.prisma.datePlan.updateMany({
        where: { id: { in: live.map((p) => p.id) } },
        data: { status: "cancelled" },
      });
    }

    const constraints: DateConstraints = {
      budget: { total: dto.budget.total, currency: dto.budget.currency ?? "KRW" },
      location: {
        city: dto.location.city,
        district: dto.location.district,
        maxTravelMinutes: dto.location.maxTravelMinutes ?? 30,
        lat: dto.location.lat,
        lng: dto.location.lng,
      },
      dateTime: {
        preferredDate: dto.dateTime.preferredDate,
        durationHours: dto.dateTime.durationHours ?? 3,
      },
      preferences: dto.preferences,
    };

    const budget = constraints.budget.total;
    const durationMinutes = constraints.dateTime.durationHours * 60;
    const avoidTypes = constraints.preferences?.avoidTypes ?? [];

    const courses: DateCourse[] = COURSE_THEMES.map((theme) => {
      const stops = this.buildCourse(theme.types, budget, durationMinutes, avoidTypes);
      return {
        courseId: randomUUID(),
        label: theme.label,
        stops,
        totalEstimatedCost: stops.reduce((sum, s) => sum + s.estimatedCost, 0),
        totalEstimatedMinutes: stops.reduce((sum, s) => sum + s.estimatedMinutes, 0),
      };
    }).filter((c) => c.stops.length > 0 && c.totalEstimatedCost <= budget);

    if (courses.length === 0) {
      courses.push({
        courseId: randomUUID(),
        label: "심플 데이트",
        stops: [
          { order: 1, type: "cafe", name: "아늑한 카페", estimatedCost: 15000, estimatedMinutes: 40, rationale: "편안한 분위기에서 대화를 시작하기 좋습니다" },
          { order: 2, type: "walk", name: "산책", estimatedCost: 0, estimatedMinutes: 30, rationale: "자연스러운 대화를 이어가기에 좋습니다" },
        ],
        totalEstimatedCost: 15000,
        totalEstimatedMinutes: 70,
      });
    }

    // 좌표를 줬다면 각 칸을 그 동네의 실제 가게로 채운다 — 그래야 코스를 그대로 쓸 수 있다.
    await this.attachRealPlaces(courses, constraints.location.lat, constraints.location.lng);

    const created = await this.prisma.datePlan.create({
      data: {
        matchId: dto.matchId,
        creatorProfileId: me.id,
        constraints: constraints as object,
        courses: courses as object[],
        status: "draft",
      },
    });
    return this.toView(created);
  }

  async select(userId: string, id: string, courseId: string): Promise<DatePlanView> {
    const { plan, myProfileId, peerProfileId } = await this.memberContext(userId, id);
    if (!plan.creatorProfileId || myProfileId !== plan.creatorProfileId) {
      throw new ForbiddenException("코스는 플랜을 만든 사람만 선택할 수 있습니다");
    }
    if (plan.status !== "draft") throw new ConflictException("이미 확정되었거나 취소된 플랜입니다");
    const courses = plan.courses as unknown as DateCourse[];
    if (!courses.some((c) => c.courseId === courseId)) {
      throw new BadRequestException("존재하지 않는 코스입니다");
    }
    const updated = await this.prisma.datePlan.update({ where: { id }, data: { selectedCourseId: courseId } });
    await this.notify(peerProfileId, id, plan.matchId, "새 데이트 플랜", "매칭 상대가 데이트 코스를 제안했어요. 확인해 보세요!");
    return this.toView(updated);
  }

  async confirm(userId: string, id: string): Promise<DatePlanView> {
    const { plan, myProfileId } = await this.memberContext(userId, id);
    if (!plan.creatorProfileId) throw new ConflictException("확정할 수 없는 플랜입니다");
    if (myProfileId === plan.creatorProfileId) {
      throw new ForbiddenException("데이트 플랜은 상대방이 확정해야 합니다");
    }
    if (!plan.selectedCourseId) throw new ConflictException("먼저 코스가 선택되어야 합니다");
    const res = await this.prisma.datePlan.updateMany({
      where: { id, status: "draft" },
      data: { status: "confirmed", confirmedAt: new Date() },
    });
    if (res.count === 0) {
      const fresh = await this.prisma.datePlan.findUnique({ where: { id } });
      if (fresh?.status === "confirmed") return this.toView(fresh);
      throw new ConflictException("확정할 수 없는 상태입니다");
    }
    const updated = await this.prisma.datePlan.findUnique({ where: { id } });
    if (!updated) throw new ConflictException("확정 처리 중 플랜을 찾을 수 없습니다");
    await this.notify(plan.creatorProfileId, id, plan.matchId, "데이트 플랜 확정", "매칭 상대가 데이트 플랜을 확정했어요!");
    return this.toView(updated);
  }

  async cancel(userId: string, id: string): Promise<DatePlanView> {
    const { plan } = await this.memberContext(userId, id);
    if (plan.status === "cancelled" || plan.status === "completed") {
      throw new ConflictException("이미 취소되었거나 완료된 플랜입니다");
    }
    const updated = await this.prisma.datePlan.update({ where: { id }, data: { status: "cancelled" } });
    return this.toView(updated);
  }

  async complete(userId: string, id: string): Promise<DatePlanView> {
    const { plan, peerProfileId } = await this.memberContext(userId, id);
    if (plan.status !== "confirmed") {
      throw new ConflictException("확정된 플랜만 완료할 수 있습니다");
    }
    const preferredDate = (plan.constraints as unknown as DateConstraints).dateTime?.preferredDate;
    if (preferredDate) {
      const plannedDay = new Date(`${preferredDate}T00:00:00+09:00`);
      if (!Number.isNaN(plannedDay.getTime()) && plannedDay.getTime() > Date.now()) {
        throw new ConflictException("만남 날짜 전에는 완료할 수 없습니다");
      }
    }
    const result = await this.prisma.datePlan.updateMany({
      where: { id, status: "confirmed" },
      data: { status: "completed", completedAt: new Date() },
    });
    if (result.count === 0) throw new ConflictException("완료할 수 없는 상태입니다");
    const updated = await this.prisma.datePlan.findUnique({ where: { id } });
    if (!updated) throw new NotFoundException("데이트 플랜을 찾을 수 없습니다");
    await this.notify(peerProfileId, id, plan.matchId, "만남 완료", "상대가 만남을 완료로 표시했어요.");
    return this.toView(updated);
  }

  /** Best-effort, non-fatal notification to a profile's owning user. */
  private async notify(
    targetProfileId: string,
    datePlanId: string,
    matchId: string,
    title: string,
    message: string,
  ) {
    try {
      const p = await this.prisma.profile.findUnique({ where: { id: targetProfileId }, select: { userId: true } });
      if (!p) return;
      await this.notifications.create({
        userId: p.userId,
        type: "reservation",
        title,
        message,
        data: { datePlanId, matchId },
      });
    } catch (err) {
      this.log.warn(`date-plan notify failed for profile ${targetProfileId}: ${err}`);
    }
  }

  /**
   * 코스의 각 칸에 실제 가게를 붙인다. 유형별로 한 번만 검색하고, 코스마다 다른 가게가 걸리도록
   * 결과를 돌려 쓴다. 좌표가 없거나 네이버 키가 없으면 조용히 아무것도 하지 않는다 —
   * 그때는 기존 유형 예시 이름("아늑한 카페")이 그대로 남는다.
   */
  private async attachRealPlaces(
    courses: DateCourse[],
    lat?: number,
    lng?: number,
  ): Promise<void> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !this.naver.configured) return;
    const types = [...new Set(courses.flatMap((c) => c.stops.map((s) => s.type)))];
    if (types.length === 0) return;

    let area: string | null = null;
    try {
      area = await this.naver.reverseArea(lat as number, lng as number);
    } catch {
      area = null;
    }

    const found = await Promise.all(
      types.map(async (type) => {
        const term = SEARCH_TERMS[type];
        if (!term) return [type, [] as NaverPlace[]] as const;
        try {
          const query = area ? `${area} ${term}` : term;
          return [type, await this.naver.searchLocal(query)] as const;
        } catch (e) {
          this.log.warn(`date-plan place lookup failed for ${type}: ${(e as Error).message}`);
          return [type, [] as NaverPlace[]] as const;
        }
      }),
    );
    const byType = new Map(found);

    // 코스 순서대로 후보를 하나씩 나눠 준다(같은 유형이 여러 코스에 있어도 다른 가게가 걸린다).
    const cursor = new Map<string, number>();
    for (const course of courses) {
      // 한 코스 안에서 같은 가게가 두 번 나오면 코스가 아니다 — 유형이 달라도(카페/맛집 검색이
      // 같은 가게를 주는 일이 있다) 이름이 겹치면 다음 후보로 넘긴다.
      const usedHere = new Set<string>();
      for (const stop of course.stops) {
        const candidates = byType.get(stop.type) ?? [];
        if (candidates.length === 0) continue;
        const start = cursor.get(stop.type) ?? 0;
        let picked: DateStopPlace | null = null;
        for (let step = 0; step < candidates.length; step++) {
          const cand = toStopPlace(candidates[(start + step) % candidates.length]);
          if (!cand || usedHere.has(cand.name)) continue;
          picked = cand;
          cursor.set(stop.type, start + step + 1);
          break;
        }
        if (!picked) continue;
        usedHere.add(picked.name);
        stop.place = picked;
        stop.name = picked.name;
      }
    }
  }

  private buildCourse(
    venueTypes: string[],
    budget: number,
    maxMinutes: number,
    avoidTypes: string[],
  ): DateStop[] {
    const stops: DateStop[] = [];
    let remainingBudget = budget;
    let remainingMinutes = maxMinutes;

    for (const type of venueTypes) {
      if (avoidTypes.includes(type)) continue;

      const template = VENUE_TEMPLATES.find((v) => v.type === type);
      if (!template) continue;

      const costFor2 = template.avgCostKRW * 2;
      if (costFor2 > remainingBudget || template.avgMinutes > remainingMinutes) continue;

      const nameIndex = Math.floor(Math.random() * template.names.length);
      const rationale = RATIONALE_MAP[type] ?? "좋은 데이트 장소입니다";

      stops.push({
        order: stops.length + 1,
        type,
        name: template.names[nameIndex],
        estimatedCost: costFor2,
        estimatedMinutes: template.avgMinutes,
        rationale,
      });

      remainingBudget -= costFor2;
      remainingMinutes -= template.avgMinutes;
    }

    return stops;
  }
}

/** 네이버 지역검색 항목 → 코스에 실을 장소. 좌표가 없으면 지도에 못 찍으니 버린다. */
function toStopPlace(p: NaverPlace): DateStopPlace | null {
  const lat = Number(p.mapy) / 1e7;
  const lng = Number(p.mapx) / 1e7;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return {
    name: p.title,
    category: p.category,
    address: p.roadAddress || p.address,
    mapUrl: `https://map.naver.com/p/search/${encodeURIComponent(p.title)}`,
    lat,
    lng,
  };
}
