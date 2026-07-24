import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SpeedDateStage } from "@mingle/shared";

/** Progressive reveal order, coarsest → clearest. A slice with N stages uses the LAST N
 *  (so 1 → [FACE], 2 → [VOICE, FACE], 3 → full) — the "build the plainest stage first" order. */
export const STAGE_ORDER_FULL: SpeedDateStage[] = ["DISGUISED", "VOICE", "FACE"];

export interface SpeedDateConfig {
  stages: number;
  stageOrder: SpeedDateStage[];
  groupPerGender: number;
  preflightMs: number;
  stageIntroMs: number;
  roundMs: number;
  intermissionMs: number;
  decisionMs: number;
  sweepMs: number;
  maxWaitMs: number;
  baseThreshold: number;
  aiFill: boolean;
  livekit: { url: string; apiKey: string; apiSecret: string };
}

function intOr(raw: string | undefined, def: number, { min = 1, max = Infinity } = {}): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
}
function floatUnit(raw: string | undefined, def: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : def;
}
function boolOr(raw: string | undefined, def: boolean): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return def;
}

@Injectable()
export class SpeedDateConfigProvider {
  readonly value: SpeedDateConfig;
  constructor(config: ConfigService) {
    // Full 3-stage reveal (DISGUISED→VOICE→FACE) is the product; slice down via env for dev/testing.
    const stages = intOr(config.get("SPEEDDATE_STAGES"), 3, { min: 1, max: 3 });
    this.value = {
      stages,
      stageOrder: STAGE_ORDER_FULL.slice(-stages),
      groupPerGender: intOr(config.get("SPEEDDATE_GROUP_PER_GENDER"), 3, { min: 2, max: 6 }),
      preflightMs: intOr(config.get("SPEEDDATE_PREFLIGHT_MS"), 20000, { min: 1000 }),
      stageIntroMs: intOr(config.get("SPEEDDATE_STAGE_INTRO_MS"), 5000, { min: 1000 }),
      roundMs: intOr(config.get("SPEEDDATE_ROUND_MS"), 300000, { min: 5000 }),
      intermissionMs: intOr(config.get("SPEEDDATE_INTERMISSION_MS"), 5000, { min: 1000 }),
      decisionMs: intOr(config.get("SPEEDDATE_DECISION_MS"), 10000, { min: 3000 }),
      sweepMs: intOr(config.get("SPEEDDATE_SWEEP_MS"), 2500, { min: 250 }),
      maxWaitMs: intOr(config.get("SPEEDDATE_MAX_WAIT_MS"), 120000, { min: 1000 }),
      baseThreshold: floatUnit(config.get("SPEEDDATE_BASE_THRESHOLD"), 0.4),
      aiFill: boolOr(config.get("SPEEDDATE_AI_FILL"), false),
      livekit: {
        url: config.get<string>("LIVEKIT_URL") ?? "",
        apiKey: config.get<string>("LIVEKIT_API_KEY") ?? "",
        apiSecret: config.get<string>("LIVEKIT_API_SECRET") ?? "",
      },
    };
  }
}
