/**
 * MingleAI MCP 타입 정의
 * @mingle/shared 타입을 re-export하고 MCP 전용 타입 추가
 */

// Re-export shared types
export type {
  Gender,
  GenderPreference,
  RelationshipGoal,
  ConversationTone,
  UserPreferences,
  UserValues,
  CommunicationStyle,
  Profile as SharedProfile,
  PartyStatus,
  TableAssignment as SharedTableAssignment,
  ConversationContext as SharedConversationContext,
  InteractionSignal as SharedInteractionSignal,
  RoundResult as SharedRoundResult,
  PartyResults as SharedPartyResults,
  Party as SharedParty,
  ReportType,
  MatchScore as SharedMatchScore,
  ConversationHighlight as SharedConversationHighlight,
  RecommendedAction,
  ActionRecommendation as SharedActionRecommendation,
  Report as SharedReport,
  DateConstraints as SharedDateConstraints,
  DateStop as SharedDateStop,
  DateCourse as SharedDateCourse,
  DatePlan as SharedDatePlan,
  DatePlanStatus,
  SafetyContext,
  ViolationType,
  ViolationSeverity,
  Violation as SharedViolation,
  SafetyResult as SharedSafetyResult,
  SafetyReportReason,
  SafetyReportStatus,
  SafetyReport as SharedSafetyReport,
} from "@mingle/shared";

// ==================== MCP 전용 타입 ====================

/**
 * 에이전트 대화 메시지
 */
export interface AgentMessage {
  agentId: string;
  agentName: string;
  content: string;
  timestamp: string;
  sentiment: "positive" | "neutral" | "negative";
  topics: string[];
}

/**
 * 에이전트 대화 세션
 */
export interface AgentConversation {
  conversationId: string;
  partyId: string;
  roundNumber: number;
  tableId: string;
  participants: {
    profileId: string;
    agentPersona: string;
  }[];
  messages: AgentMessage[];
  analysis: ConversationAnalysis;
  createdAt: string;
}

/**
 * 대화 분석 결과
 */
export interface ConversationAnalysis {
  rapport: number; // 0-1
  sharedInterests: string[];
  conversationFlow: "natural" | "awkward" | "engaging";
  compatibility: number; // 0-1
  highlights: string[];
}

/**
 * 아이스브레이커 생성 결과
 */
export interface IcebreakerResult {
  icebreaker: string;
  suggestedTopics: string[];
  approach: "casual" | "deep" | "playful";
}

/**
 * 실제 장소 정보 (외부 API)
 */
export interface RealVenue {
  id: string;
  name: string;
  category: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  rating?: number;
  priceRange: "low" | "medium" | "high";
  openingHours?: string;
  phone?: string;
  url?: string;
  photos?: string[];
}

/**
 * 장소 검색 필터
 */
export interface VenueSearchFilter {
  query?: string;
  category?: string;
  location: {
    lat: number;
    lng: number;
  };
  radius?: number; // meters
  priceRange?: "low" | "medium" | "high";
}

/**
 * 플랫폼 통계
 */
export interface PlatformStats {
  totalUsers: number;
  totalProfiles: number;
  totalParties: number;
  completedParties: number;
  totalReports: number;
  totalDatePlans: number;
  safetyReports: {
    pending: number;
    resolved: number;
  };
  averageMatchScore: number;
}

/**
 * MCP 도구 응답 래퍼
 */
export interface ToolResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
