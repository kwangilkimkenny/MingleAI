/**
 * RoleReveal — full-card overlay shown at game start to reveal the viewer's role.
 * Auto-calls onDone after 3000ms. Impostor uses the pink accent; crew uses ink.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Skull, Wrench } from "lucide-react-native";
import type { AmongRole } from "@mingle/shared";
import { colors, fonts } from "../../lib/theme";
import { DoodleCard } from "../Doodle";

export function RoleReveal({ role, onDone }: { role: AmongRole; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  // (임포스터 분기는 도달 불가 — 인간은 항상 crew, 임포스터는 AI 페르소나 전용 — 타입상 유지)
  const isImpostor = role === "impostor";
  const label = isImpostor ? "당신은 임포스터" : "AI를 찾아라";
  const sub = isImpostor
    ? "크루메이트를 처치하고 방해하세요!"
    : "파티에 AI 2명이 숨어 있어요.\n채팅과 행동으로 찾아내 투표하세요!";
  const accent = isImpostor ? colors.accent : colors.ink;

  return (
    <View style={styles.overlay}>
      <DoodleCard style={styles.card}>
        <View style={styles.inner}>
          {isImpostor ? (
            <Skull color={accent} size={52} strokeWidth={2} />
          ) : (
            <Wrench color={accent} size={52} strokeWidth={2} />
          )}
          <Text style={[styles.label, { color: accent }]}>{label}</Text>
          <Text style={styles.sub}>{sub}</Text>
          <Text style={styles.hint}>잠시 후 게임이 시작됩니다...</Text>
        </View>
      </DoodleCard>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(23,21,15,0.72)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 24,
  },
  // alignSelf: ShadowBox 기본 stretch가 부모 alignItems를 무시하므로 center 명시 필수
  card: { width: "100%", maxWidth: 560, alignSelf: "center" },
  inner: { alignItems: "center", gap: 12, paddingVertical: 8 },
  label: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    color: colors.grayDark,
    textAlign: "center",
    lineHeight: 20,
  },
  hint: {
    fontSize: 12,
    color: colors.grayMid,
    marginTop: 4,
  },
});
