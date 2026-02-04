import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDatePlanDto } from "./dto/create-date-plan.dto";
import type { DateCourse, DateStop, DateConstraints } from "@mingle/shared";

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

type ProfileRow = {
  values: { lifestyle: string[] };
  communicationStyle: { topics: string[] };
};

@Injectable()
export class DatePlanService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDatePlanDto) {
    const profile1 = await this.prisma.profile.findUnique({ where: { id: dto.profileId1 } });
    if (!profile1) throw new NotFoundException(`프로필을 찾을 수 없습니다: ${dto.profileId1}`);

    const profile2 = await this.prisma.profile.findUnique({ where: { id: dto.profileId2 } });
    if (!profile2) throw new NotFoundException(`프로필을 찾을 수 없습니다: ${dto.profileId2}`);

    const p1 = profile1 as unknown as ProfileRow;
    const p2 = profile2 as unknown as ProfileRow;

    const sharedLifestyle = p1.values.lifestyle.filter((l) => p2.values.lifestyle.includes(l));

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
      const stops = this.buildCourse(theme.types, budget, durationMinutes, avoidTypes, sharedLifestyle);
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

    return this.prisma.datePlan.create({
      data: {
        profileId1: dto.profileId1,
        profileId2: dto.profileId2,
        constraints: constraints as object,
        courses: courses as object[],
        status: "draft",
      },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.datePlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException(`데이트 플랜을 찾을 수 없습니다: ${id}`);
    return plan;
  }

  private buildCourse(
    venueTypes: string[],
    budget: number,
    maxMinutes: number,
    avoidTypes: string[],
    sharedLifestyle: string[],
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
      let rationale = RATIONALE_MAP[type] ?? "좋은 데이트 장소입니다";
      if (sharedLifestyle.length > 0) {
        rationale += ` (공유 라이프스타일: ${sharedLifestyle.slice(0, 2).join(", ")})`;
      }

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
