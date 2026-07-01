import { Injectable } from "@nestjs/common";
import type { PreferenceSignals } from "@mingle/shared";
import type { AnalyzeInput, PreferenceAnalyzer } from "./preference-analyzer.interface";
import { parsePreferenceSignals } from "./preference-signals.schema";

@Injectable()
export class StubPreferenceAnalyzer implements PreferenceAnalyzer {
  async analyze(input: AnalyzeInput): Promise<PreferenceSignals> {
    const t = input.partyPreferenceText.toLowerCase();
    const has = (...w: string[]) => w.some((x) => t.includes(x));
    const vibe = has("조용", "차분", "calm", "quiet") ? "calm"
      : has("활발", "신나", "energetic") ? "energetic" : "balanced";
    const drinking = has("술 없", "논알콜", "no drink", "술없") ? "none"
      : has("가볍게 한잔", "light") ? "light" : "social";
    const pace = has("천천", "slow") ? "slow" : has("빠르", "fast") ? "fast" : "medium";
    const activity: string[] = [];
    if (has("보드게임", "boardgame")) activity.push("boardgame");
    if (has("떠들", "수다", "talk")) activity.push("talking");
    if (has("게임", "game") && !activity.includes("boardgame")) activity.push("game");
    return parsePreferenceSignals({
      vibe, activity, drinking, pace,
      tags: activity, summary: input.partyPreferenceText.slice(0, 120),
    });
  }
}
