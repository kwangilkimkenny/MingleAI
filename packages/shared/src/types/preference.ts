export type PreferenceVibe = "calm" | "energetic" | "balanced";
export type PreferenceDrinking = "none" | "light" | "social";
export type PreferencePace = "slow" | "medium" | "fast";

export interface PreferenceSignals {
  vibe: PreferenceVibe;
  activity: string[];
  drinking: PreferenceDrinking;
  pace: PreferencePace;
  tags: string[];
  summary: string;
}
