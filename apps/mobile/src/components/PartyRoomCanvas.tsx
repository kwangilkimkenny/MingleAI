import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Canvas, Circle, RoundedRect } from "@shopify/react-native-skia";
import { clampToRoom, initialOf, type Vec2 } from "../lib/party-space";

const INK = "#17150F";
const PAPER = "#FFFFFF";
const FILL = "#F1EFE9";
const AVATAR_R = 14;

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
      style={{ height }}
      accessibilityLabel="파티 공간"
    >
      {width > 0 ? (
        <>
          <Canvas style={{ width, height }}>
            <RoundedRect x={1} y={1} width={width - 2} height={height - 2} r={12} color={FILL} />
            <RoundedRect
              x={1}
              y={1}
              width={width - 2}
              height={height - 2}
              r={12}
              color={INK}
              style="stroke"
              strokeWidth={2}
            />
            {members.map((m) => (
              <Circle
                key={m.profileId}
                cx={m.pos.x * width}
                cy={m.pos.y * height}
                r={AVATAR_R}
                color={m.profileId === myProfileId ? INK : PAPER}
              />
            ))}
            {members.map((m) => (
              <Circle
                key={`ring-${m.profileId}`}
                cx={m.pos.x * width}
                cy={m.pos.y * height}
                r={AVATAR_R}
                color={INK}
                style="stroke"
                strokeWidth={2}
              />
            ))}
          </Canvas>
          {members.map((m) => {
            const mine = m.profileId === myProfileId;
            return (
              <View
                key={m.profileId}
                pointerEvents="none"
                style={[
                  styles.label,
                  {
                    left: m.pos.x * width - AVATAR_R,
                    top: m.pos.y * height - AVATAR_R,
                  },
                ]}
              >
                <Text style={[styles.initial, { color: mine ? PAPER : INK }]}>
                  {initialOf(m.name)}
                </Text>
              </View>
            );
          })}
        </>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    position: "absolute",
    width: AVATAR_R * 2,
    height: AVATAR_R * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 12, fontWeight: "700" },
});
