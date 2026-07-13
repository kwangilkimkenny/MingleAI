import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { clampToRoom, initialOf, type Vec2 } from "../lib/party-space";

/**
 * Among-Us-style 2D party space. A top-down floor with circular avatars (initials)
 * that move to a tapped point. Rendered with plain RN Views so it works identically
 * on web (react-native-web) and native — no Skia/CanvasKit, no per-platform fallback.
 * Positions are normalized 0..1; the parent drives movement via the `members` prop.
 */
const INK = "#17150F";
const PAPER = "#FFFFFF";
const FILL = "#F1EFE9";
const AVATAR_R = 16;

export interface PartyRoomMember {
  profileId: string;
  name: string;
  pos: Vec2;
}

export function PartyRoomCanvas({
  members,
  myProfileId,
  onTapMove,
  height = 260,
}: {
  members: PartyRoomMember[];
  myProfileId: string | null;
  onTapMove: (target: Vec2) => void;
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
      accessibilityLabel="파티 공간 — 탭해서 이동"
    >
      {width > 0
        ? members.map((m) => {
            const mine = m.profileId === myProfileId;
            return (
              <View
                key={m.profileId}
                pointerEvents="none"
                style={[
                  styles.avatar,
                  {
                    left: m.pos.x * width - AVATAR_R,
                    top: m.pos.y * height - AVATAR_R,
                    backgroundColor: mine ? INK : PAPER,
                  },
                ]}
              >
                <Text style={[styles.initial, { color: mine ? PAPER : INK }]}>
                  {initialOf(m.name)}
                </Text>
              </View>
            );
          })
        : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floor: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 12,
    backgroundColor: FILL,
    overflow: "hidden",
  },
  avatar: {
    position: "absolute",
    width: AVATAR_R * 2,
    height: AVATAR_R * 2,
    borderRadius: AVATAR_R,
    borderWidth: 2,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 13, fontWeight: "700" },
});
