export interface DateConstraints {
  budget: {
    total: number;
    currency: string;
  };
  location: {
    city: string;
    district?: string;
    maxTravelMinutes: number;
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

export interface DateStop {
  order: number;
  type: string;
  name: string;
  estimatedCost: number;
  estimatedMinutes: number;
  rationale: string;
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
  merchantPayKey?: string;
  paymentId?: string;
  paymentStatus?: string;
  paymentAmount?: number;
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
  createdAt: string;
}
