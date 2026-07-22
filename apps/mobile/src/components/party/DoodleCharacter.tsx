/**
 * 파티 월드의 종이 인형형 두들 아바타. 한 장의 4×3 투명 아틀라스를 공유해 메모리를 아끼고,
 * profileId 시드로 같은 사람에게 항상 같은 외형을 배정한다. 흑백 선화와 흰 종이 받침은 복잡한
 * 맵에서도 실루엣을 보존하며, 코랄은 오직 '나' 표시에만 사용한다.
 */
import { Image, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { lookFor } from "../../lib/character-look";
import { colors, fonts } from "../../lib/theme";

export const CHAR_BOX = { w: 1.0, h: 1.72 } as const;

const ATLAS_COLUMNS = 4;
const ATLAS_ROWS = 3;
const ATLAS_SOURCE = require("../../../assets/characters/party-doodle-atlas.png");

function DoodleAtlasCell({ index, width }: { index: number; width: number }) {
  const height = width * (ATLAS_COLUMNS / ATLAS_ROWS);
  const column = index % ATLAS_COLUMNS;
  const row = Math.floor(index / ATLAS_COLUMNS);

  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <Image
        source={ATLAS_SOURCE}
        fadeDuration={0}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
        style={{
          position: "absolute",
          width: width * ATLAS_COLUMNS,
          height: height * ATLAS_ROWS,
          left: -column * width,
          top: -row * height,
        }}
      />
    </View>
  );
}

/** Member/profile surfaces reuse the same world identity without exposing atlas math. */
export function PartyDoodlePortrait({ characterKey, size = 44 }: { characterKey: string; size?: number }) {
  const look = lookFor(characterKey);
  const spriteWidth = size * 0.72;
  return (
    <View
      accessible={false}
      style={[styles.portrait, { width: size, height: size, pointerEvents: "none" }]}
    >
      <DoodleAtlasCell index={look.avatarIndex} width={spriteWidth} />
    </View>
  );
}

export function DoodleCharacter({
  characterKey,
  name,
  mine,
  walking,
  facing,
  phase,
  ghost = false,
  size = 44,
}: {
  characterKey: string;
  name: string;
  mine: boolean;
  walking: boolean;
  facing: 1 | -1;
  phase: number;
  ghost?: boolean;
  size?: number;
}) {
  const reduce = useReducedMotion();
  const look = lookFor(characterKey);
  const bob = reduce || !walking ? 0 : -Math.abs(Math.sin(phase / 135)) * (size * 0.055);
  const stepTilt = reduce || !walking ? 0 : Math.sin(phase / 135) * 1.4;
  const floatY = ghost && !reduce ? Math.sin(phase / 500) * 2.5 : 0;
  const spriteWidth = size;

  return (
    <View style={[styles.wrap, { pointerEvents: "none" }]} accessible={false}>
      <View style={styles.statusRow}>
        {mine && !ghost ? (
          <View style={styles.mineMarker}>
            <Text style={styles.mineMarkerText}>나</Text>
          </View>
        ) : null}
        {ghost ? (
          <View style={styles.ghostMarker}>
            <Text style={styles.ghostMarkerText}>관전</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.tag, mine && styles.tagMine]}>
        <Text style={[styles.tagText, mine && styles.tagTextMine]} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <View
        style={{
          width: spriteWidth,
          height: spriteWidth * (ATLAS_COLUMNS / ATLAS_ROWS),
          opacity: ghost ? 0.5 : 1,
          transform: [
            { translateY: bob + floatY },
            { scaleX: facing },
            { rotate: `${stepTilt * facing}deg` },
          ],
        }}
      >
        <View style={styles.paperPawn} />
        <DoodleAtlasCell index={look.avatarIndex} width={spriteWidth} />
      </View>
    </View>
  );
}

/** 탈락한 캐릭터도 동일한 외형을 유지해 누구의 상태인지 바로 식별할 수 있다. */
export function DoodleCorpse({ characterKey, size = 40 }: { characterKey: string; size?: number }) {
  const look = lookFor(characterKey);
  return (
    <View accessible={false} pointerEvents="none" style={[styles.corpseWrap, { width: size * 1.5 }]}>
      <View
        style={{
          width: size * 0.72,
          height: size * 0.96,
          opacity: 0.48,
          transform: [{ rotate: "-78deg" }, { translateY: size * 0.12 }],
        }}
      >
        <View style={styles.paperPawn} />
        <DoodleAtlasCell index={look.avatarIndex} width={size * 0.72} />
      </View>
      <View style={styles.outBadge}>
        <Text style={styles.outBadgeText}>탈락</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  statusRow: { minHeight: 20, flexDirection: "row", alignItems: "center", gap: 3 },
  mineMarker: {
    minWidth: 24,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  mineMarkerText: { fontFamily: fonts.bodySemibold, fontSize: 12, lineHeight: 16, color: colors.onAccent },
  ghostMarker: {
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: colors.fillDeep,
    borderWidth: 1,
    borderColor: colors.grayDark,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostMarkerText: { fontFamily: fonts.bodySemibold, fontSize: 11, lineHeight: 15, color: colors.grayDark },
  tag: {
    maxWidth: 88,
    minHeight: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: colors.ink,
    backgroundColor: "rgba(255,255,255,0.94)",
    marginBottom: 2,
    justifyContent: "center",
  },
  tagMine: { backgroundColor: colors.ink },
  tagText: { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 17, color: colors.ink },
  tagTextMine: { color: colors.paper },
  paperPawn: {
    position: "absolute",
    left: "10%",
    right: "10%",
    top: "7%",
    bottom: "6%",
    backgroundColor: colors.paper,
    opacity: 0.96,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 19,
  },
  portrait: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-start",
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 11,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 17,
    backgroundColor: colors.partyRoomWarm,
  },
  corpseWrap: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  outBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    paddingHorizontal: 5,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.2,
    borderColor: colors.ink,
    backgroundColor: colors.fillDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  outBadgeText: { fontFamily: fonts.bodySemibold, fontSize: 11, lineHeight: 15, color: colors.ink },
});
