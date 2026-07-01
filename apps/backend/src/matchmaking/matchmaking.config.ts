import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface MatchmakingConfig {
  min: number;
  max: number;
  sweepMs: number;
  maxWaitMs: number;
  baseThreshold: number;
}

function intOr(raw: string | undefined, def: number, { min = 1 } = {}): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : def;
}
function floatOr(raw: string | undefined, def: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

@Injectable()
export class MatchmakingConfigProvider {
  readonly value: MatchmakingConfig;
  constructor(config: ConfigService) {
    const min = intOr(config.get("MIN_PARTY_SIZE"), 4);
    const maxRaw = intOr(config.get("MAX_PARTY_SIZE"), 8);
    this.value = {
      min,
      max: Math.max(min, maxRaw),
      sweepMs: intOr(config.get("MATCH_SWEEP_MS"), 2500, { min: 250 }),
      maxWaitMs: intOr(config.get("MATCH_MAX_WAIT_MS"), 120000, { min: 1000 }),
      baseThreshold: floatOr(config.get("MATCH_BASE_THRESHOLD"), 0.5),
    };
  }
}
