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

export type DatePlanStatus = "draft" | "confirmed" | "completed";

export interface DatePlan {
  id: string;
  profileId1: string;
  profileId2: string;
  constraints: DateConstraints;
  courses: DateCourse[];
  status: DatePlanStatus;
  createdAt: string;
}
