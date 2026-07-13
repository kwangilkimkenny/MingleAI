/**
 * AmongGame — orchestrator component for the Among Us minigame.
 * Switches between idle/playing/meeting-voting/ended views.
 * Presentational: all side-effects go through `handlers` and `onTapMove`.
 */
import { useState, useEffect, useCallback } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { AmongSnapshot, AmongRole } from "@mingle/shared";
import type { Vec2 } from "../../lib/party-space";
import { spawnFor } from "../../lib/party-space";
import { nearestTask, nearestKillTarget, nearbyBody, RANGE } from "../../lib/among";
import { colors, fonts } from "../../lib/theme";
import { DoodleButton, DoodleCard } from "../Doodle";
import { MiniGame } from "./minigames";
import { AmongMap } from "./AmongMap";
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
  onTapMove,
  handlers,
}: {
  among: AmongSnapshot | null;
  myProfileId: string;
  partyId: string;
  positions: Record<string, Vec2>;
  onTapMove: (t: Vec2) => void;
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

  const handleRoleRevealDone = useCallback(() => {
    if (among?.sessionId) {
      setRevealedSessionId(among.sessionId);
    }
  }, [among?.sessionId]);

  const closeMiniGame = useCallback(() => setMiniGameTaskId(null), []);

  // ── Idle (no active game) ─────────────────────────────────────────────────
  if (!among) {
    return (
      <DoodleCard style={styles.idleCard}>
        <View style={styles.idleInner}>
          <Text style={styles.idleTitle}>어몽어스</Text>
          <Text style={styles.idleHint}>4명 이상이 모이면 시작할 수 있어요</Text>
          <DoodleButton title="어몽어스 시작" onPress={handlers.start} variant="primary" />
        </View>
      </DoodleCard>
    );
  }

  // ── Meeting / Voting ──────────────────────────────────────────────────────
  if (among.phase === "meeting" || among.phase === "voting") {
    return (
      <MeetingScreen snapshot={among} myProfileId={myProfileId} onVote={handlers.vote} />
    );
  }

  // ── Ended ─────────────────────────────────────────────────────────────────
  if (among.phase === "ended") {
    return (
      <ResultScreen
        result={among.result}
        players={among.players}
        onRestart={handlers.restart}
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
  const cooldownReady =
    !among.killCooldownUntil || among.killCooldownUntil <= Date.now();
  const nearKillTarget =
    isImpostor && cooldownReady && !iAmDead
      ? nearestKillTarget(myPos, among.players, positions, RANGE.kill, myProfileId)
      : null;
  const nearBody = iAmDead ? null : nearbyBody(myPos, among.bodies, RANGE.kill);

  // Active minigame task (for the modal)
  const activeTask = miniGameTaskId
    ? among.myTasks.find((t) => t.taskId === miniGameTaskId) ?? null
    : null;

  return (
    <View style={styles.playingContainer}>
      {/* Progress bar */}
      <View style={styles.progressRow}>
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
      </View>

      {/* 2D map */}
      <AmongMap
        myProfileId={myProfileId}
        positions={positions}
        players={among.players}
        myTasks={among.myTasks}
        bodies={among.bodies}
        onTapMove={onTapMove}
      />

      {/* Spectator notice */}
      {iAmDead && (
        <View style={styles.spectatorBadge}>
          <Text style={styles.spectatorText}>관전 중 👻</Text>
        </View>
      )}

      {/* Context action bar (hidden when dead) */}
      {!iAmDead && (
        <View style={styles.actionBar}>
          {nearTask && (
            <DoodleButton
              title="미션 수행"
              onPress={() => setMiniGameTaskId(nearTask.taskId)}
              variant="primary"
              style={styles.actionBtn}
            />
          )}
          {nearKillTarget && (
            <DoodleButton
              title="킬"
              onPress={() =>
                handlers.kill(nearKillTarget.profileId, myPos.x, myPos.y)
              }
              variant="primary"
              style={styles.actionBtn}
            />
          )}
          {nearBody && (
            <DoodleButton
              title="신고"
              onPress={() => handlers.report(nearBody.profileId)}
              style={styles.actionBtn}
            />
          )}
          <DoodleButton
            title="긴급 회의"
            onPress={handlers.emergency}
            style={styles.actionBtn}
          />
        </View>
      )}

      {/* Minigame modal */}
      <Modal
        visible={activeTask !== null}
        transparent
        animationType="slide"
        onRequestClose={closeMiniGame}
      >
        <View style={styles.modalOverlay}>
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
  // Idle
  idleCard: {},
  idleInner: { alignItems: "center", gap: 14, paddingVertical: 8 },
  idleTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
  },
  idleHint: {
    fontSize: 13,
    color: colors.grayMid,
    textAlign: "center",
  },

  // Playing
  playingContainer: { gap: 10 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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

  spectatorBadge: {
    alignSelf: "center",
    backgroundColor: colors.fillDeep,
    borderWidth: 1,
    borderColor: colors.grayMid,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  spectatorText: { fontSize: 13, color: colors.grayMid },

  actionBar: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionBtn: { flex: 1, minWidth: 120 },

  // Minigame modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(23,21,15,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 2,
    borderTopColor: colors.ink,
    padding: 20,
    minHeight: 320,
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
