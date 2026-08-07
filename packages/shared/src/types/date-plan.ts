export interface DateConstraints {
  budget: {
    total: number;
    currency: string;
  };
  location: {
    city: string;
    district?: string;
    maxTravelMinutes: number;
    /** 지도에서 고른 만날 지역의 좌표 — 있으면 코스에 실제 장소가 붙는다. */
    lat?: number;
    lng?: number;
  };
  dateTime: {
    preferredDate: string;
    durationHours: number;
  };
  preferences?: {
    cuisineTypes?: string[];
    activityTypes?: string[];
    avoidTypes?: string[];
  };
}

/** 코스 한 칸에 붙는 실제 가게 — 좌표가 주어졌을 때만 채워진다(네이버 지역검색). */
export interface DateStopPlace {
  name: string;
  category: string;
  address: string;
  /** 네이버 지도 장소 페이지 — 예약·전화·길찾기가 붙어 있다. */
  mapUrl: string;
  lat: number;
  lng: number;
}

export interface DateStop {
  order: number;
  type: string;
  name: string;
  estimatedCost: number;
  estimatedMinutes: number;
  rationale: string;
  /** 실제 가게. 없으면 name이 유형 예시(“아늑한 카페”)라는 뜻. */
  place?: DateStopPlace;
}

export interface DateCourse {
  courseId: string;
  label: string;
  stops: DateStop[];
  totalEstimatedCost: number;
  totalEstimatedMinutes: number;
}

export type DatePlanStatus = "draft" | "confirmed" | "cancelled" | "completed";

export interface DatePlan {
  id: string;
  matchId: string;
  creatorProfileId?: string | null;
  constraints: DateConstraints;
  courses: DateCourse[];
  status: DatePlanStatus;
  selectedCourseId?: string;
  confirmedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

/** API projection — no payment fields exposed. */
export interface DatePlanView {
  id: string;
  matchId: string;
  creatorProfileId: string | null;
  constraints: DateConstraints;
  courses: DateCourse[];
  status: DatePlanStatus;
  selectedCourseId: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
