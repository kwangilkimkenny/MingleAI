/**
 * AmongGame — orchestrator component for the Among Us minigame.
 * Switches between idle/playing/meeting-voting/ended views.
 * Presentational: all side-effects go through `handlers`.
 */
import { useState, useEffect, useCallback } from "react";
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ghost, Wrench, X } from "lucide-react-native";
import type { AmongSnapshot, AmongRole, GameReveal } from "@mingle/shared";
import type { Vec2 } from "../../lib/party-space";
import { spawnFor } from "../../lib/party-space";
import { nearestTask, nearestKillTarget, nearbyBody, RANGE } from "../../lib/among";
import { colors, control, doodle, space, type } from "../../lib/theme";
import { PartyWorld, type WorldCharacter } from "../party/PartyWorld";
import { ActionPad, type PadAction } from "../party/ActionPad";
import { MiniGame } from "./minigames";
import { RoleReveal } from "./RoleReveal";
import { MeetingScreen } from "./MeetingScreen";
import { ResultScreen } from "./ResultScreen";
import { useReducedMotion } from "react-native-reanimated";
import { nearestPendingTask } from "../../lib/task-guidance";
import { useInitialAccessibilityFocus } from "../../lib/accessibility";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  onReturnToLobby,
  balanceReveals = [],
}: {
  among: AmongSnapshot | null;
  myProfileId: string;
  partyId: string;
  positions: Record<string, Vec2>;
  characters: WorldCharacter[];
  clock: number;
  handlers: AmongHandlers;
  onReturnToLobby: () => void;
  /** Completed balance-game rounds from this party, used only for post-game social reflection. */
  balanceReveals?: GameReveal[];
}) {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  // Track which sessionId we have already revealed the role for
  const [revealedSessionId, setRevealedSessionId] = useState<string | null>(null);
  // Minigame modal state
  const [miniGameTaskId, setMiniGameTaskId] = useState<string | null>(null);
  const [screenReader, setScreenReader] = useState(false);
  const miniGameFocusRef = useInitialAccessibilityFocus(miniGameTaskId !== null);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled().then((enabled) => active && setScreenReader(enabled));
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

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
      <ResultScreen
        snapshot={among}
        balanceReveals={balanceReveals}
        onRestart={handlers.restart}
        onLobby={onReturnToLobby}
      />
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
  const nextAccessibleTask = among.myTasks.find((task) => !task.done) ?? null;
  const taskGuidance = nearestPendingTask(myPos, among.myTasks);

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
      label: "발견",
      accessibilityLabel: "가까운 시체 발견 알리기",
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
          .map((t) => ({
            id: t.taskId,
            x: t.x,
            y: t.y,
            primary: t.taskId === taskGuidance?.task.taskId,
          }))}
        safeInsets={insets}
        clock={clock}
      />

      {/* 진행률 — 상단 중앙 오버레이 */}
      <View
        style={[styles.progressRow, { pointerEvents: "none" }]}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`미션 진행률 ${among.progress.done}/${among.progress.total}${autoMeetingSec !== null ? `, 투표까지 ${autoMeetingSec}초` : ""}`}
      >
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

      {taskGuidance && !iAmDead ? (
        <View
          style={[styles.taskGuide, { pointerEvents: "none" }]}
          accessible
          accessibilityLabel={`다음 미션, ${taskGuidance.direction}, ${taskGuidance.distanceLabel}`}
        >
          <Wrench color={colors.accent} size={15} strokeWidth={2.6} />
          <Text style={styles.taskGuideText} numberOfLines={1}>
            다음 미션 · {taskGuidance.direction} · {taskGuidance.distanceLabel}
          </Text>
        </View>
      ) : null}

      {iAmDead ? (
        <View style={[styles.spectatorBadge, { bottom: 24 + insets.bottom, pointerEvents: "none" }]}>
          <Ghost color={colors.grayMid} size={15} strokeWidth={2.2} />
          <Text style={styles.spectatorText}>관전 중</Text>
        </View>
      ) : (
        <ActionPad
          main={mainAction}
          secondaries={secondaries}
          style={[styles.actionPad, { right: 16 + insets.right, bottom: 20 + insets.bottom }]}
        />
      )}
      {screenReader && !iAmDead && nextAccessibleTask ? (
        <Pressable
          style={[styles.accessibleTaskButton, { bottom: 20 + insets.bottom }]}
          onPress={() => setMiniGameTaskId(nextAccessibleTask.taskId)}
          accessibilityRole="button"
          accessibilityLabel={`남은 미션 바로 시작. ${among.progress.done}/${among.progress.total} 완료`}
          accessibilityHint="공간 이동 없이 다음 미션을 엽니다"
        >
          <Text style={styles.accessibleTaskText}>다음 미션 바로 시작</Text>
        </Pressable>
      ) : null}

      {/* Minigame modal */}
      <Modal
        visible={activeTask !== null}
        transparent
        animationType={reducedMotion ? "none" : "slide"}
        onRequestClose={closeMiniGame}
      >
        <View style={styles.modalOverlay} accessibilityViewIsModal>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeMiniGame}
            accessibilityLabel="미니게임 닫기"
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View
                ref={miniGameFocusRef}
                accessible
                accessibilityRole="header"
                accessibilityLabel="미션 미니게임"
              >
                <Text style={styles.modalTitle}>미션</Text>
              </View>
              <Pressable
                onPress={closeMiniGame}
                style={({ pressed }) => [styles.modalClose, pressed && { opacity: 0.65 }]}
                accessibilityRole="button"
                accessibilityLabel="미니게임 닫기"
              >
                <X color={colors.ink} size={22} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
            {activeTask && (
              <MiniGame
                kind={activeTask.kind}
                onComplete={() => {
                  handlers.doTask(activeTask.taskId, activeTask.x, activeTask.y);
                  closeMiniGame();
                }}
              />
            )}
            </ScrollView>
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
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: space.x3,
    paddingVertical: space.x2,
  },
  progressLabel: { ...type.caption, color: colors.ink, minWidth: 72 },
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
    backgroundColor: colors.success,
    borderRadius: 4,
  },
  progressCount: { ...type.caption, color: colors.ink, minWidth: 32, textAlign: "right" },
  autoMeetingText: { ...type.caption, color: colors.warning, minWidth: 84, textAlign: "right" },
  taskGuide: {
    position: "absolute",
    top: 58,
    alignSelf: "center",
    maxWidth: 320,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.x3,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 9,
    zIndex: 18,
  },
  taskGuideText: { ...type.caption, fontFamily: "Pretendard_600SemiBold", color: colors.ink },

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
  spectatorText: { ...type.caption, color: colors.grayDark },

  actionPad: { position: "absolute", zIndex: 20 },
  accessibleTaskButton: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    minHeight: control.buttonHeight,
    paddingHorizontal: space.x4,
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 12,
    zIndex: 22,
  },
  accessibleTaskText: { ...type.label, color: colors.onAccent },

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
    maxHeight: "92%",
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 20,
    padding: space.x4,
    minHeight: 280,
  },
  modalHeader: {
    minHeight: control.minTouch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.x1,
  },
  modalTitle: { ...type.heading, color: colors.ink },
  modalClose: {
    width: control.minTouch,
    height: control.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: { paddingBottom: space.x2 },
});
