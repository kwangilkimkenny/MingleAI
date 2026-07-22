/**
 * RoleReveal — full-card overlay shown at game start to reveal the viewer's role.
 * The player explicitly confirms the role so assistive technology and slower readers never lose it.
 */
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Skull, Wrench } from "lucide-react-native";
import type { AmongRole } from "@mingle/shared";
import { colors, layout, space, type } from "../../lib/theme";
import { DoodleButton, DoodleCard } from "../Doodle";
import { hapticImpact } from "../../lib/haptics";
import { useInitialAccessibilityFocus } from "../../lib/accessibility";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function RoleReveal({ role, onDone }: { role: AmongRole; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  // (임포스터 분기는 도달 불가 — 인간은 항상 crew, 임포스터는 AI 페르소나 전용 — 타입상 유지)
  const isImpostor = role === "impostor";
  const label = isImpostor ? "당신은 임포스터" : "AI를 찾아라";
  const sub = isImpostor
    ? "크루메이트를 처치하고 방해하세요!"
    : "파티에 AI 2명이 숨어 있어요.\n채팅과 행동으로 찾아내 투표하세요!";
  const accent = isImpostor ? colors.danger : colors.success;
  const focusRef = useInitialAccessibilityFocus(true);

  return (
    <ScrollView
      style={styles.overlay}
      contentContainerStyle={[
        styles.overlayContent,
        {
          paddingTop: layout.screenGutter + insets.top,
          paddingRight: layout.screenGutter + insets.right,
          paddingBottom: layout.screenGutter + insets.bottom,
          paddingLeft: layout.screenGutter + insets.left,
        },
      ]}
      accessibilityViewIsModal
      showsVerticalScrollIndicator
    >
      <DoodleCard style={styles.card}>
        <View style={styles.inner}>
          <View
            ref={focusRef}
            style={styles.roleSummary}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${label}. ${sub.replace("\n", " ")}`}
          >
            {isImpostor ? (
              <Skull color={accent} size={52} strokeWidth={2} />
            ) : (
              <Wrench color={accent} size={52} strokeWidth={2} />
            )}
            <Text style={[styles.label, { color: accent }]}>{label}</Text>
          </View>
          <Text style={styles.sub}>{sub}</Text>
          <View style={styles.callout}>
            <Text style={styles.calloutTitle}>{isImpostor ? "목표" : "이번 게임의 목표"}</Text>
            <Text style={styles.calloutBody}>
              {isImpostor
                ? "들키지 않게 행동하되, 다른 사용자를 불편하게 만드는 대화는 피해주세요."
                : "미션을 수행하고 대화의 맥락을 살펴본 뒤 투표에서 직접 판단하세요."}
            </Text>
          </View>
          <View style={styles.action}>
            <DoodleButton
              title="역할을 확인했어요 · 게임 시작"
              onPress={() => {
                hapticImpact();
                onDone();
              }}
              variant="primary"
            />
          </View>
        </View>
      </DoodleCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(23,21,15,0.72)",
    zIndex: 100,
  },
  overlayContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: layout.screenGutter,
  },
  // alignSelf: ShadowBox 기본 stretch가 부모 alignItems를 무시하므로 center 명시 필수
  card: { width: "100%", maxWidth: 560, alignSelf: "center" },
  inner: { alignItems: "center", gap: space.x3, paddingVertical: space.x2 },
  roleSummary: { alignItems: "center", gap: space.x2 },
  label: {
    ...type.display,
    textAlign: "center",
  },
  sub: { ...type.body, color: colors.ink, textAlign: "center" },
  callout: {
    alignSelf: "stretch",
    gap: space.x1,
    padding: space.x3,
    backgroundColor: colors.fill,
    borderRadius: 12,
  },
  calloutTitle: { ...type.label, color: colors.ink },
  calloutBody: { ...type.caption, color: colors.grayDark },
  action: { width: "100%", marginTop: space.x1 },
});
