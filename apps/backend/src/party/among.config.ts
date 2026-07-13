import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface AmongConfig {
  minPlayers: number;
  impostors: number;
  tasksPerCrew: number;
  killRange: number;
  taskRange: number;
  killCooldownMs: number;
  discussionMs: number;
  voteMs: number;
  emergencyPerPlayer: number;
  sweepMs: number;
}

function intOr(raw: string | undefined, def: number, { min = 1 } = {}): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : def;
}

function floatUnit(raw: string | undefined, def: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : def;
}

@Injectable()
export class AmongConfigProvider {
  readonly value: AmongConfig;
  constructor(config: ConfigService) {
    this.value = {
      minPlayers: intOr(config.get("AMONG_MIN_PLAYERS"), 4, { min: 2 }),
      impostors: intOr(config.get("AMONG_IMPOSTORS"), 1, { min: 1 }),
      tasksPerCrew: intOr(config.get("AMONG_TASKS_PER_CREW"), 3, { min: 1 }),
      killRange: floatUnit(config.get("AMONG_KILL_RANGE"), 0.12),
      taskRange: floatUnit(config.get("AMONG_TASK_RANGE"), 0.10),
      killCooldownMs: intOr(config.get("AMONG_KILL_COOLDOWN_MS"), 20000, { min: 1000 }),
      discussionMs: intOr(config.get("AMONG_DISCUSSION_MS"), 30000, { min: 3000 }),
      voteMs: intOr(config.get("AMONG_VOTE_MS"), 30000, { min: 3000 }),
      emergencyPerPlayer: intOr(config.get("AMONG_EMERGENCY_PER_PLAYER"), 1, { min: 0 }),
      sweepMs: intOr(config.get("AMONG_SWEEP_MS"), 1000, { min: 250 }),
    };
  }
}
