/**
 * AmongGame — orchestrator component for the Among Us minigame.
 * Switches between idle/playing/meeting-voting/ended views.
 * Presentational: all side-effects go through `handlers`.
 */
import { useState, useEffect, useCallback } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ghost } from "lucide-react-native";
import type { AmongSnapshot, AmongRole } from "@mingle/shared";
import type { Vec2 } from "../../lib/party-space";
import { spawnFor } from "../../lib/party-space";
import { nearestTask, nearestKillTarget, nearbyBody, RANGE } from "../../lib/among";
import { colors } from "../../lib/theme";
import { PartyWorld, type WorldCharacter } from "../party/PartyWorld";
import { ActionPad, type PadAction } from "../party/ActionPad";
import { MiniGame } from "./minigames";
import { RoleReveal } from "./RoleReveal";
import { MeetingScreen } from "./MeetingScreen";
import { ResultScreen } from "./ResultScreen";

export interface AmongHandlers {
  start: () => void;
  doTask: (taskId: string, x: number, y: number) => void;
  kill: (targetProfileId: string, x: number, y: number) => void;
  report: (bodyProfileId: string) => void;
  emergency: () => void;
  vote: (target: string) => void;
  restart: () => void;
}

export function AmongGame({
  among,
  myProfileId,
  partyId,
  positions,
  characters,
  clock,
  handlers,
}: {
  among: AmongSnapshot | null;
  myProfileId: string;
  partyId: string;
  positions: Record<string, Vec2>;
  characters: WorldCharacter[];
  clock: number;
  handlers: AmongHandlers;
}) {
  // Track which sessionId we have already revealed the role for
  const [revealedSessionId, setRevealedSessionId] = useState<string | null>(null);
  // Minigame modal state
  const [miniGameTaskId, setMiniGameTaskId] = useState<string | null>(null);

  // When sessionId changes (new game), reset revealed state
  useEffect(() => {
    if (among?.sessionId && among.sessionId !== revealedSessionId) {
      // Don't reset here — we gate on "not yet revealed this session"
      // The reveal card will call setRevealedSessionId when done
    }
  }, [among?.sessionId, revealedSessionId]);

  // 킬 쿨다운 링은 초 단위 갱신이 필요 — 쿨다운 진행 중에만 1s 틱.
  const [, setCooldownTick] = useState(0);
  useEffect(() => {
    const until = among?.killCooldownUntil;
    if (!until || until <= Date.now()) return;
    const t = setInterval(() => {
      setCooldownTick((v) => v + 1);
      if (until <= Date.now()) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [among?.killCooldownUntil]);

  // among.nextAutoMeetingAt 기반 남은 초 — 진행 중에만 1s 틱.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (!among?.nextAutoMeetingAt || among.phase !== "playing") return;
    const t = setInterval(() => setClockTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [among?.nextAutoMeetingAt, among?.phase]);
  const autoMeetingSec = among?.nextAutoMeetingAt
    ? Math.max(0, Math.ceil((among.nextAutoMeetingAt - Date.now()) / 1000))
    : null;

  const handleRoleRevealDone = useCallback(() => {
    if (among?.sessionId) {
      setRevealedSessionId(among.sessionId);
    }
  }, [among?.sessionId]);

  const closeMiniGame = useCallback(() => setMiniGameTaskId(null), []);

  // ── Idle (no active game) ─────────────────────────────────────────────────
  // Parent (party screen) only mounts AmongGame once `among` is non-null, so
  // this branch is unreachable in practice — kept as a defensive guard.
  if (!among) return null;

  // ── Meeting / Voting ──────────────────────────────────────────────────────
  if (among.phase === "meeting" || among.phase === "voting") {
    return <MeetingScreen snapshot={among} myProfileId={myProfileId} onVote={handlers.vote} />;
  }

  // ── Ended ─────────────────────────────────────────────────────────────────
  if (among.phase === "ended") {
    return (
      <ResultScreen result={among.result} players={among.players} onRestart={handlers.restart} />
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  // Role reveal gate
  const roleKnown = among.myRole !== null;
  const alreadyRevealed = revealedSessionId === among.sessionId;
  if (roleKnown && !alreadyRevealed) {
    return <RoleReveal role={among.myRole as AmongRole} onDone={handleRoleRevealDone} />;
  }

  // Compute context actions
  const myPos = positions[myProfileId] ?? spawnFor(myProfileId);
  const myPlayer = among.players.find((p) => p.profileId === myProfileId);
  const iAmDead = myPlayer ? !myPlayer.alive : false;

  const nearTask = iAmDead ? null : nearestTask(myPos, among.myTasks, RANGE.task);
  const isImpostor = among.myRole === "impostor";
  const cooldownReady = !among.killCooldownUntil || among.killCooldownUntil <= Date.now();
  const nearKillTarget =
    isImpostor && cooldownReady && !iAmDead
      ? nearestKillTarget(myPos, among.players, positions, RANGE.kill, myProfileId)
      : null;
  const nearBody = iAmDead ? null : nearbyBody(myPos, among.bodies, RANGE.kill);

  // Active minigame task (for the modal)
  const activeTask = miniGameTaskId
    ? (among.myTasks.find((t) => t.taskId === miniGameTaskId) ?? null)
    : null;

  // 어몽 캐릭터: 로비 배열에 사망자 ghost 플래그를 입힌다
  const aliveById = new Map(among.players.map((p) => [p.profileId, p.alive]));
  const amongChars: WorldCharacter[] = characters
    .filter((c) => aliveById.has(c.profileId))
    .map((c) => ({ ...c, ghost: aliveById.get(c.profileId) === false }));

  const KILL_COOLDOWN_MS = 20000; // 서버 기본값(AMONG_KILL_COOLDOWN_MS) — 링 근사 표시용
  const cooldownLeft = among.killCooldownUntil ? among.killCooldownUntil - Date.now() : 0;
  const mainAction: PadAction = nearTask
    ? { key: "task", label: "미션", onPress: () => setMiniGameTaskId(nearTask.taskId) }
    : { key: "idle", label: "사용", onPress: () => {}, disabled: true };
  const secondaries: PadAction[] = [
    {
      key: "report",
      label: "신고",
      onPress: () => nearBody && handlers.report(nearBody.profileId),
      disabled: !nearBody,
    },
    { key: "emergency", label: "긴급", onPress: handlers.emergency },
  ];
  if (isImpostor) {
    secondaries.push({
      key: "kill",
      label: "킬",
      accent: true,
      onPress: () => nearKillTarget && handlers.kill(nearKillTarget.profileId, myPos.x, myPos.y),
      disabled: !nearKillTarget,
      cooldownRatio: cooldownLeft > 0 ? Math.min(1, cooldownLeft / KILL_COOLDOWN_MS) : undefined,
      sub: cooldownLeft > 0 ? `${Math.ceil(cooldownLeft / 1000)}s` : undefined,
    });
  }

  return (
    <View style={styles.playingContainer}>
      <PartyWorld
        characters={amongChars}
        bodies={among.bodies}
        taskMarkers={among.myTasks
          .filter((t) => !t.done)
          .map((t) => ({ id: t.taskId, x: t.x, y: t.y }))}
        clock={clock}
      />

      {/* 진행률 — 상단 중앙 오버레이 */}
      <View style={styles.progressRow} pointerEvents="none">
        <Text style={styles.progressLabel}>미션 진행률</Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${among.progress.total > 0 ? (among.progress.done / among.progress.total) * 100 : 0}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressCount}>
          {among.progress.done}/{among.progress.total}
        </Text>
        {autoMeetingSec !== null && (
          <Text style={styles.autoMeetingText}>투표까지 {autoMeetingSec}s</Text>
        )}
      </View>

      {iAmDead ? (
        <View style={styles.spectatorBadge} pointerEvents="none">
          <Ghost color={colors.grayMid} size={15} strokeWidth={2.2} />
          <Text style={styles.spectatorText}>관전 중</Text>
        </View>
      ) : (
        <ActionPad main={mainAction} secondaries={secondaries} style={styles.actionPad} />
      )}

      {/* Minigame modal */}
      <Modal
        visible={activeTask !== null}
        transparent
        animationType="slide"
        onRequestClose={closeMiniGame}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeMiniGame}
            accessibilityLabel="미니게임 닫기"
          />
          <View style={styles.modalSheet}>
            <Pressable onPress={closeMiniGame} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>✕ 닫기</Text>
            </Pressable>
            {activeTask && (
              <MiniGame
                kind={activeTask.kind}
                onComplete={() => {
                  handlers.doTask(activeTask.taskId, activeTask.x, activeTask.y);
                  closeMiniGame();
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Playing
  playingContainer: { flex: 1 },
  progressRow: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    width: "50%",
    maxWidth: 420,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  progressLabel: { fontSize: 12, color: colors.grayDark, minWidth: 60 },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.grayLight,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.ink,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.ink,
    borderRadius: 4,
  },
  progressCount: { fontSize: 12, color: colors.grayDark, minWidth: 28, textAlign: "right" },
  autoMeetingText: { fontSize: 11, color: colors.grayDark, minWidth: 70, textAlign: "right" },

  spectatorBadge: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.fillDeep,
    borderWidth: 1,
    borderColor: colors.grayMid,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  spectatorText: { fontSize: 13, color: colors.grayMid },

  actionPad: { position: "absolute", right: 16, bottom: 20, zIndex: 20 },

  // Minigame modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(23,21,15,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalSheet: {
    backgroundColor: colors.paper,
    width: "100%",
    maxWidth: 480,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 20,
    padding: 20,
    minHeight: 280,
  },
  modalClose: {
    alignSelf: "flex-end",
    marginBottom: 12,
    padding: 4,
  },
  modalCloseText: {
    fontSize: 14,
    color: colors.grayDark,
    fontWeight: "600",
  },
});
