import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { SafetyService } from "../safety/safety.service";
import { NotificationService } from "../notification/notification.service";
import { CreateDatePlanDto } from "./dto/create-date-plan.dto";
import type { DateCourse, DateStop, DateConstraints, DatePlanView } from "@mingle/shared";

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

    const constraints: DateConstraints = {
      budget: { total: dto.budget.total, currency: dto.budget.currency ?? "KRW" },
      location: {
        city: dto.location.city,
        district: dto.location.district,
        maxTravelMinutes: dto.location.maxTravelMinutes ?? 30,
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
