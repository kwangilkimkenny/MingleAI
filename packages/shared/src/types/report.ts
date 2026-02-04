export type ReportType = "summary" | "detailed";

export interface MatchScore {
  partnerId: string;
  partnerName: string;
  overallScore: number;
  breakdown: {
    valuesAlignment: number;
    lifestyleCompatibility: number;
    communicationFit: number;
    interestChemistry: number;
  };
  explanation: string;
}

export interface ConversationHighlight {
  partnerId: string;
  partnerName: string;
  highlights: string[];
  sharedInterests: string[];
  notableExchanges: string[];
}

export interface RecommendedAction {
  type: "send_message" | "ask_question" | "suggest_date" | "learn_more" | "pass";
  content: string;
  rationale: string;
}

export interface ActionRecommendation {
  partnerId: string;
  partnerName: string;
  recommendedActions: RecommendedAction[];
}

export interface Report {
  id: string;
  partyId: string;
  profileId: string;
  reportType: ReportType;
  matchScores: MatchScore[];
  highlights: ConversationHighlight[];
  recommendations: ActionRecommendation[];
  createdAt: string;
}
