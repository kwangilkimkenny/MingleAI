/**
 * RoleReveal — full-card overlay shown at game start to reveal the viewer's role.
 * Auto-calls onDone after 3000ms. Impostor uses the pink accent; crew uses ink.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AmongRole } from "@mingle/shared";
import { colors, fonts } from "../../lib/theme";
import { DoodleCard } from "../Doodle";

export function RoleReveal({ role, onDone }: { role: AmongRole; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  const isImpostor = role === "impostor";
  const label = isImpostor ? "당신은 임포스터 🔪" : "당신은 크루메이트 🛠️";
  const sub = isImpostor
    ? "크루메이트를 처치하고 방해하세요!"
    : "모든 미션을 완료하거나 임포스터를 찾아내세요!";
  const accent = isImpostor ? colors.accent : colors.ink;

  return (
    <View style={styles.overlay}>
      <DoodleCard style={styles.card}>
        <View style={styles.inner}>
          <Text style={[styles.emoji]}>{isImpostor ? "🔪" : "🛠️"}</Text>
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
  card: { width: "100%", maxWidth: 560 },
  inner: { alignItems: "center", gap: 12, paddingVertical: 8 },
  emoji: { fontSize: 56 },
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
