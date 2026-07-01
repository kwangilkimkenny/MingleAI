import type { PreferenceSignals } from "@mingle/shared";

export interface AnalyzeInput {
  partyPreferenceText: string;
  gender: string;
  age: number;
  occupation: string;
}

export interface PreferenceAnalyzer {
  analyze(input: AnalyzeInput): Promise<PreferenceSignals>;
}

export const PREFERENCE_ANALYZER = Symbol("PREFERENCE_ANALYZER");

export class PreferenceAnalysisError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "PreferenceAnalysisError";
  }
}
