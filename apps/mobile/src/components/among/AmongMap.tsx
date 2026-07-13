/**
 * AmongMap — top-down 2D game map for the Among Us minigame.
 * Plain RN Views (no Skia), same normalized-coord approach as PartyRoomCanvas.
 * Shows: players (alive/dead), the viewer's incomplete task stations, dead bodies.
 * Tap on floor → onTapMove(clampToRoom normalized coord).
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { clampToRoom, initialOf, spawnFor, type Vec2 } from "../../lib/party-space";
import { colors } from "../../lib/theme";
import type { AmongPlayerView, AmongTaskView, AmongBodyView } from "@mingle/shared";

const AVATAR_R = 16;
const TASK_SIZE = 14;
const BODY_SIZE = 18;

export function AmongMap({
  myProfileId,
  positions,
  players,
  myTasks,
  bodies,
  onTapMove,
  height = 280,
}: {
  myProfileId: string;
  positions: Record<string, Vec2>;
  players: AmongPlayerView[];
  myTasks: AmongTaskView[];
  bodies: AmongBodyView[];
  onTapMove: (t: Vec2) => void;
  height?: number;
}) {
  const [width, setWidth] = useState(0);

  return (
    <Pressable
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPress={(e) => {
        if (!width) return;
        onTapMove(
          clampToRoom({
            x: e.nativeEvent.locationX / width,
            y: e.nativeEvent.locationY / height,
          }),
        );
      }}
      style={[styles.floor, { height }]}
      accessibilityLabel="어몽어스 맵 — 탭해서 이동"
    >
      {width > 0 ? (
        <>
          {/* Task station markers (pink outline squares) for incomplete tasks */}
          {myTasks
            .filter((t) => !t.done)
            .map((t) => (
              <View
                key={t.taskId}
                pointerEvents="none"
                style={[
                  styles.taskMarker,
                  {
                    left: t.x * width - TASK_SIZE / 2,
                    top: t.y * height - TASK_SIZE / 2,
                  },
                ]}
              />
            ))}

          {/* Dead body markers */}
          {bodies.map((b) => (
            <View
              key={b.profileId}
              pointerEvents="none"
              style={[
                styles.bodyMarker,
                {
                  left: b.x * width - BODY_SIZE / 2,
                  top: b.y * height - BODY_SIZE / 2,
                },
              ]}
            >
              <Text style={styles.bodyX}>✕</Text>
            </View>
          ))}

          {/* Player avatars */}
          {players.map((p) => {
            const pos = positions[p.profileId] ?? spawnFor(p.profileId);
            const mine = p.profileId === myProfileId;
            const dead = !p.alive;
            const bg = dead
              ? colors.grayLight
              : mine
                ? colors.ink
                : colors.paper;
            const fg = dead ? colors.grayMid : mine ? colors.paper : colors.ink;
            const borderColor = dead ? colors.grayMid : colors.ink;
            return (
              <View
                key={p.profileId}
                pointerEvents="none"
                style={[
                  styles.avatar,
                  {
                    left: pos.x * width - AVATAR_R,
                    top: pos.y * height - AVATAR_R,
                    backgroundColor: bg,
                    borderColor,
                    opacity: dead ? 0.45 : 1,
                  },
                ]}
              >
                <Text style={[styles.initial, { color: fg }]}>{initialOf(p.name)}</Text>
              </View>
            );
          })}
        </>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floor: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    backgroundColor: colors.fill,
    overflow: "hidden",
  },
  avatar: {
    position: "absolute",
    width: AVATAR_R * 2,
    height: AVATAR_R * 2,
    borderRadius: AVATAR_R,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 13, fontWeight: "700" },
  taskMarker: {
    position: "absolute",
    width: TASK_SIZE,
    height: TASK_SIZE,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accentFill,
    borderRadius: 3,
  },
  bodyMarker: {
    position: "absolute",
    width: BODY_SIZE,
    height: BODY_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  bodyX: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.grayDark,
  },
});
