import { PARTY_MAP, WORLD_ASPECT, worldDist } from "@mingle/shared";
import type { AmongConfig } from "../among.config";
import type { AmongState } from "../among.service";

export interface BotStep {
  moves: { profileId: string; x: number; y: number }[];
  kill: { killerId: string; targetId: string; x: number; y: number } | null;
  chats: { profileId: string; scene: "idle" }[];
  votes: { profileId: string; targetId: string | null }[];
}

export const AI_BOT_SPEED = 0.22; // world/s — 인간(0.45)보다 느긋하게
export const AI_KILL_PROB = 0.35; // 조건 충족 틱당 발동 확률
export const AI_KILL_RANGE_GRACE = 1.0; // cfg.killRange 배수(world 계량)
export const AI_WITNESS_RADIUS = 0.3; // world — 제3 생존 인간 목격 회피 반경
export const AI_POST_MEETING_HOLD_MS = 15000;

/**
 * AI 임포스터 행동 결정(틱당 1회, 게이트웨이 스윕이 advisory-lock tx 안에서 호출).
 * state.ai.bots를 변이(위치 전진·타이머)하고 부수효과 목록(BotStep)을 반환한다.
 * LLM 없는 결정(이동/킬 판정/발화 타이밍/투표 필요 여부)만 담당 — 텍스트·투표 대상은 호출부.
 */
export class AiImpostorBrain {
  static tick(
    state: AmongState,
    humanPos: Record<string, { x: number; y: number }>,
    cfg: AmongConfig,
    now: number,
    rand: () => number = Math.random,
  ): BotStep {
    const step: BotStep = { moves: [], kill: null, chats: [], votes: [] };
    const aliveAis = state.players.filter((p) => p.isAi && p.alive);

    if (state.phase === "voting" && state.meeting) {
      for (const ai of aliveAis) {
        if (state.meeting.votes[ai.profileId] === undefined) {
          step.votes.push({ profileId: ai.profileId, targetId: null });
        }
      }
      return step;
    }
    if (state.phase !== "playing") return step;

    // 구세션 방어: ai 블록 없음
    const bots = state.ai?.bots;
    if (!bots) return step;

    const dtSec = cfg.sweepMs / 1000;
    for (const ai of aliveAis) {
      const bot = bots[ai.profileId];
      if (!bot) continue;

      // 킬 판정 (틱당 전체 1건 제한 — 이동 전에 검사, 현재 위치 기준)
      const cooldownReady = ai.killCooldownUntil === null || ai.killCooldownUntil <= now;
      if (step.kill === null && cooldownReady && now >= bot.killHoldUntil) {
        const aliveHumans = state.players.filter((p) => !p.isAi && p.alive);
        const near = aliveHumans
          .map((h) => ({ h, pos: humanPos[h.profileId] }))
          .filter((e) => e.pos && worldDist(bot, e.pos!) <= cfg.killRange * AI_KILL_RANGE_GRACE);
        if (near.length > 0) {
          const victim = near[0]!;
          const witnesses = aliveHumans.filter(
            (h) =>
              h.profileId !== victim.h.profileId &&
              humanPos[h.profileId] &&
              worldDist(bot, humanPos[h.profileId]!) <= AI_WITNESS_RADIUS,
          );
          if (witnesses.length === 0 && rand() < AI_KILL_PROB) {
            step.kill = {
              killerId: ai.profileId,
              targetId: victim.h.profileId,
              x: bot.x,
              y: bot.y,
            };
          }
        }
      }

      // 이동: 목표 스테이션으로 전진, 도착 시 다음 목표
      const target = PARTY_MAP.stations[bot.targetIdx % PARTY_MAP.stations.length]!;
      const d = worldDist(bot, target);
      if (d < 0.05) {
        bot.targetIdx = Math.floor(rand() * PARTY_MAP.stations.length);
      } else {
        const stepLen = Math.min(AI_BOT_SPEED * dtSec, d);
        const wdx = (target.x - bot.x) * WORLD_ASPECT;
        const wdy = target.y - bot.y;
        bot.x += ((wdx / d) * stepLen) / WORLD_ASPECT;
        bot.y += (wdy / d) * stepLen;
      }
      step.moves.push({ profileId: ai.profileId, x: bot.x, y: bot.y });

      // 발화 타이밍
      if (now >= bot.nextChatAt) {
        step.chats.push({ profileId: ai.profileId, scene: "idle" });
        bot.nextChatAt = now + cfg.aiChatMinMs + rand() * (cfg.aiChatMaxMs - cfg.aiChatMinMs);
      }
    }
    return step;
  }
}
