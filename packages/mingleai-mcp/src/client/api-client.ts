/**
 * Backend REST API 클라이언트
 * 모든 MCP 도구는 이 클라이언트를 통해 Backend와 통신
 */

import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "../config.js";

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // 요청 인터셉터: JWT 토큰 자동 주입
    this.client.interceptors.request.use((reqConfig) => {
      if (config.authToken) {
        reqConfig.headers.Authorization = `Bearer ${config.authToken}`;
      }
      return reqConfig;
    });

    // 응답 인터셉터: 에러 정규화
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (error.response) {
          const apiError: ApiError = {
            statusCode: error.response.status,
            message:
              error.response.data?.message ||
              error.message ||
              "Unknown error",
            error: error.response.data?.error,
          };
          return Promise.reject(apiError);
        }
        return Promise.reject({
          statusCode: 500,
          message: error.message || "Network error",
        });
      }
    );
  }

  // ==================== Auth ====================

  async register(email: string, password: string): Promise<{ accessToken: string }> {
    const { data } = await this.client.post("/auth/register", { email, password });
    return data;
  }

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const { data } = await this.client.post("/auth/login", { email, password });
    return data;
  }

  // ==================== Profiles ====================

  async createProfile(profileData: CreateProfileInput): Promise<Profile> {
    const { data } = await this.client.post("/profiles", profileData);
    return data;
  }

  async getProfile(id: string): Promise<Profile> {
    const { data } = await this.client.get(`/profiles/${id}`);
    return data;
  }

  async updateProfile(id: string, updates: UpdateProfileInput): Promise<Profile> {
    const { data } = await this.client.patch(`/profiles/${id}`, updates);
    return data;
  }

  async listProfiles(filters?: ProfileFilters): Promise<Profile[]> {
    const { data } = await this.client.get("/profiles", { params: filters });
    return data;
  }

  // ==================== Parties ====================

  async listParties(filters?: { status?: string; limit?: number; offset?: number }): Promise<{
    parties: (Party & { participantCount: number })[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const { data } = await this.client.get("/parties", { params: filters });
    return data;
  }

  async createParty(partyData: CreatePartyInput): Promise<Party> {
    const { data } = await this.client.post("/parties", partyData);
    return data;
  }

  async getParty(id: string): Promise<Party> {
    const { data } = await this.client.get(`/parties/${id}`);
    return data;
  }

  async addParticipant(partyId: string, profileId: string): Promise<void> {
    await this.client.post(`/parties/${partyId}/participants`, { profileId });
  }

  async runParty(partyId: string): Promise<Party> {
    const { data } = await this.client.post(`/parties/${partyId}/run`);
    return data;
  }

  async getPartyResults(partyId: string): Promise<{ results: PartyResults }> {
    const { data } = await this.client.get(`/parties/${partyId}/results`);
    return data;
  }

  // ==================== Reports ====================

  async generateReport(input: GenerateReportInput): Promise<Report> {
    const { data } = await this.client.post("/reports/generate", input);
    return data;
  }

  async getReport(id: string): Promise<Report> {
    const { data } = await this.client.get(`/reports/${id}`);
    return data;
  }

  async listReports(profileId: string, limit?: number, offset?: number): Promise<Report[]> {
    const { data } = await this.client.get("/reports", {
      params: { profileId, limit, offset },
    });
    return data;
  }

  // ==================== Date Plans ====================

  async createDatePlan(input: CreateDatePlanInput): Promise<DatePlan> {
    const { data } = await this.client.post("/date-plans", input);
    return data;
  }

  async getDatePlan(id: string): Promise<DatePlan> {
    const { data } = await this.client.get(`/date-plans/${id}`);
    return data;
  }

  // ==================== Safety ====================

  async checkContent(content: string, context: string): Promise<SafetyResult> {
    const { data } = await this.client.post("/safety/check", { content, context });
    return data;
  }

  async reportUser(input: ReportUserInput): Promise<SafetyReport> {
    const { data } = await this.client.post("/safety/report", input);
    return data;
  }

  // ==================== Health ====================

  async healthCheck(): Promise<{ status: string }> {
    const { data } = await this.client.get("/health");
    return data;
  }
}

// 싱글톤 인스턴스
export const apiClient = new ApiClient();

// ==================== Type Definitions ====================

export interface Profile {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: string;
  location: string;
  occupation?: string;
  preferences: Record<string, unknown>;
  values: Record<string, unknown>;
  communicationStyle: Record<string, unknown>;
  bio?: string;
  agentPersona: string;
  riskScore: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfileInput {
  name: string;
  age: number;
  gender: string;
  location: string;
  occupation?: string;
  bio?: string;
  preferences: {
    ageRange: { min: number; max: number };
    genderPreference: string[];
    locationRadius: number;
    dealbreakers?: string[];
  };
  values: {
    relationshipGoal: string;
    lifestyle: string[];
    importantValues: string[];
  };
  communicationStyle: {
    tone: string;
    topics: string[];
  };
}

export interface UpdateProfileInput {
  bio?: string;
  location?: string;
  preferences?: Partial<CreateProfileInput["preferences"]>;
  values?: Partial<CreateProfileInput["values"]>;
  communicationStyle?: Partial<CreateProfileInput["communicationStyle"]>;
}

export interface ProfileFilters {
  location?: string;
  ageMin?: number;
  ageMax?: number;
  relationshipGoal?: string;
  limit?: number;
  offset?: number;
}

export interface Party {
  id: string;
  name: string;
  scheduledAt: string;
  maxParticipants: number;
  theme?: string;
  roundCount: number;
  roundDurationMinutes: number;
  status: string;
  results?: PartyResults;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePartyInput {
  name: string;
  scheduledAt: string;
  maxParticipants?: number;
  theme?: string;
  roundCount?: number;
  roundDurationMinutes?: number;
}

export interface PartyResults {
  rounds: RoundResult[];
  interactionSignals: InteractionSignal[];
}

export interface RoundResult {
  roundNumber: number;
  tables: TableAssignment[];
}

export interface TableAssignment {
  tableId: string;
  participants: string[];
  context: ConversationContext;
}

export interface ConversationContext {
  participants: string[];
  icebreaker: string;
  suggestedTopics: string[];
}

export interface InteractionSignal {
  fromProfileId: string;
  toProfileId: string;
  roundNumber: number;
  signalType: string;
  strength: number;
}

export interface Report {
  id: string;
  partyId: string;
  profileId: string;
  reportType: string;
  matchScores: MatchScore[];
  highlights: ConversationHighlight[];
  recommendations: ActionRecommendation[];
  createdAt: string;
}

export interface GenerateReportInput {
  partyId: string;
  profileId: string;
  reportType?: string;
}

export interface MatchScore {
  partnerId: string;
  overallScore: number;
  breakdown: {
    valuesAlignment: number;
    lifestyleCompatibility: number;
    communicationFit: number;
    interestChemistry: number;
  };
}

export interface ConversationHighlight {
  partnerId: string;
  sharedInterests: string[];
  notableExchanges: string[];
}

export interface ActionRecommendation {
  partnerId: string;
  actionType: string;
  reason: string;
  suggestedMessage?: string;
}

export interface DatePlan {
  id: string;
  profileId1: string;
  profileId2: string;
  constraints: DateConstraints;
  courses: DateCourse[];
  status: string;
  createdAt: string;
}

export interface CreateDatePlanInput {
  profileId1: string;
  profileId2: string;
  budget: { total: number; currency?: string };
  location: { city: string; district?: string; maxTravelMinutes?: number };
  dateTime: { preferredDate: string; durationHours?: number };
  preferences?: {
    cuisineTypes?: string[];
    activityTypes?: string[];
    avoidTypes?: string[];
  };
}

export interface DateConstraints {
  budget: { total: number; currency: string };
  location: { city: string; district?: string; maxTravelMinutes: number };
  dateTime: { preferredDate: string; durationHours: number };
  preferences?: {
    cuisineTypes?: string[];
    activityTypes?: string[];
    avoidTypes?: string[];
  };
}

export interface DateCourse {
  courseId: string;
  theme: string;
  stops: DateStop[];
  totalCost: number;
  totalDuration: number;
}

export interface DateStop {
  order: number;
  venue: string;
  category: string;
  duration: number;
  cost: number;
  note?: string;
}

export interface SafetyResult {
  safe: boolean;
  violations: Violation[];
  riskScore: number;
  sanitized?: string;
}

export interface Violation {
  type: string;
  severity: string;
  description: string;
  matchedContent?: string;
}

export interface SafetyReport {
  id: string;
  reporterProfileId: string;
  reportedProfileId: string;
  reason: string;
  details?: string;
  evidencePartyId?: string;
  status: string;
  createdAt: string;
}

export interface ReportUserInput {
  reportedProfileId: string;
  reason: string;
  details?: string;
  evidencePartyId?: string;
}
