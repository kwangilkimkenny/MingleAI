import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { DatePlanRepo } from "../storage/date-plan.repo.js";
import { ProfileRepo } from "../storage/profile.repo.js";
import type { DatePlan, DateConstraints, DateCourse, DateStop } from "@mingle/shared";

interface VenueTemplate {
  type: string;
  names: string[];
  avgCostKRW: number;
  avgMinutes: number;
  tags: string[];
}

const VENUE_TEMPLATES: VenueTemplate[] = [
  { type: "cafe", names: ["아늑한 카페", "루프탑 카페", "브런치 카페", "디저트 카페"], avgCostKRW: 15000, avgMinutes: 40, tags: ["casual", "warm", "cozy"] },
  { type: "restaurant", names: ["이탈리안 레스토랑", "한식당", "일식당", "프렌치 비스트로", "태국 레스토랑"], avgCostKRW: 40000, avgMinutes: 60, tags: ["dining", "foodie"] },
  { type: "walk", names: ["한강 산책", "공원 산책", "고궁 산책", "숲길 산책"], avgCostKRW: 0, avgMinutes: 30, tags: ["active", "nature", "romantic"] },
  { type: "museum", names: ["미술관 관람", "전시회 방문", "갤러리 투어"], avgCostKRW: 15000, avgMinutes: 60, tags: ["culture", "art", "thoughtful"] },
  { type: "movie", names: ["영화 관람"], avgCostKRW: 28000, avgMinutes: 120, tags: ["entertainment", "relaxing"] },
  { type: "concert", names: ["공연 관람", "라이브 카페"], avgCostKRW: 50000, avgMinutes: 90, tags: ["music", "entertainment", "lively"] },
  { type: "activity", names: ["방탈출", "볼링", "보드게임 카페", "쿠킹 클래스"], avgCostKRW: 25000, avgMinutes: 60, tags: ["fun", "active", "playful"] },
  { type: "bar", names: ["와인바", "칵테일바", "크래프트 비어바"], avgCostKRW: 30000, avgMinutes: 50, tags: ["evening", "social", "relaxing"] },
];

const COURSE_THEMES = [
  { label: "편안하고 따뜻한 데이트", types: ["cafe", "walk", "restaurant"] },
  { label: "문화와 미식의 만남", types: ["museum", "cafe", "restaurant"] },
  { label: "액티브 & 펀 데이트", types: ["activity", "restaurant", "bar"] },
];

export class DatePlanService {
  private datePlanRepo: DatePlanRepo;
  private profileRepo: ProfileRepo;

  constructor(db: Database.Database) {
    this.datePlanRepo = new DatePlanRepo(db);
    this.profileRepo = new ProfileRepo(db);
  }

  create(profileId1: string, profileId2: string, constraints: DateConstraints): DatePlan {
    const profile1 = this.profileRepo.findById(profileId1);
    if (!profile1) throw new Error(`프로필을 찾을 수 없습니다: ${profileId1}`);

    const profile2 = this.profileRepo.findById(profileId2);
    if (!profile2) throw new Error(`프로필을 찾을 수 없습니다: ${profileId2}`);

    // Combine preferences
    const sharedLifestyle = [
      ...profile1.values.lifestyle.filter((l) => profile2.values.lifestyle.includes(l)),
    ];
    const sharedTopics = [
      ...profile1.communicationStyle.topics.filter((t) =>
        profile2.communicationStyle.topics.includes(t)
      ),
    ];

    const budget = constraints.budget.total;
    const durationMinutes = constraints.dateTime.durationHours * 60;

    const courses: DateCourse[] = COURSE_THEMES.map((theme) => {
      const stops = this.buildCourse(
        theme.types,
        budget,
        durationMinutes,
        constraints,
        sharedLifestyle,
        sharedTopics
      );

      return {
        courseId: randomUUID(),
        label: theme.label,
        stops,
        totalEstimatedCost: stops.reduce((sum, s) => sum + s.estimatedCost, 0),
        totalEstimatedMinutes: stops.reduce((sum, s) => sum + s.estimatedMinutes, 0),
      };
    }).filter((c) => c.stops.length > 0 && c.totalEstimatedCost <= budget);

    if (courses.length === 0) {
      // Fallback: simple cafe + walk course
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

    const datePlan: DatePlan = {
      id: randomUUID(),
      profileId1,
      profileId2,
      constraints,
      courses,
      status: "draft",
      createdAt: new Date().toISOString(),
    };

    this.datePlanRepo.insert(datePlan);
    return datePlan;
  }

  getById(id: string): DatePlan | null {
    return this.datePlanRepo.findById(id);
  }

  private buildCourse(
    venueTypes: string[],
    budget: number,
    maxMinutes: number,
    constraints: DateConstraints,
    sharedLifestyle: string[],
    sharedTopics: string[]
  ): DateStop[] {
    const stops: DateStop[] = [];
    let remainingBudget = budget;
    let remainingMinutes = maxMinutes;

    const avoidTypes = constraints.preferences?.avoidTypes ?? [];

    for (let i = 0; i < venueTypes.length; i++) {
      const type = venueTypes[i];
      if (avoidTypes.includes(type)) continue;

      const template = VENUE_TEMPLATES.find((v) => v.type === type);
      if (!template) continue;

      // Cost for 2 people
      const costFor2 = template.avgCostKRW * 2;
      if (costFor2 > remainingBudget) continue;
      if (template.avgMinutes > remainingMinutes) continue;

      const nameIndex = Math.floor(Math.random() * template.names.length);
      const rationale = this.generateRationale(type, sharedLifestyle, sharedTopics);

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

  private generateRationale(type: string, sharedLifestyle: string[], sharedTopics: string[]): string {
    const rationaleMap: Record<string, string> = {
      cafe: "편안한 분위기에서 대화를 시작하기 좋습니다",
      restaurant: "함께 맛있는 식사를 즐기며 친밀감을 높일 수 있습니다",
      walk: "자연스러운 분위기에서 깊은 대화를 나눌 수 있습니다",
      museum: "문화적 경험을 공유하며 서로의 취향을 알 수 있습니다",
      movie: "함께 감상 경험을 공유할 수 있습니다",
      concert: "음악을 통한 감정 공유가 가능합니다",
      activity: "함께 활동하며 자연스럽게 팀워크를 경험할 수 있습니다",
      bar: "편안한 분위기에서 하루를 마무리할 수 있습니다",
    };

    let rationale = rationaleMap[type] ?? "좋은 데이트 장소입니다";

    if (sharedLifestyle.length > 0) {
      rationale += ` (공유 라이프스타일: ${sharedLifestyle.slice(0, 2).join(", ")})`;
    }

    return rationale;
  }
}
