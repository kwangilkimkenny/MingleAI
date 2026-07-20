/**
 * ResultScreen — shown when among.phase === "ended".
 * Reveals winner + all players' roles. "다시하기" CTA.
 */
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Bot, Flag, PartyPopper, Skull, Wrench } from "lucide-react-native";
import type { AmongPlayerView, AmongResultView } from "@mingle/shared";
import { colors, fonts } from "../../lib/theme";
import { DoodleButton, DoodleCard } from "../Doodle";

const REASON_LABELS: Record<AmongResultView["reason"], string> = {
  tasks: "모든 미션 완료",
  ejected: "AI 전원 추방",
  kills: "크루메이트 전멸",
};

export function ResultScreen({
  result,
  players,
  onRestart,
}: {
  // null when the game was force-ended (among:end) with no winner decided.
  result: AmongResultView | null;
  players: AmongPlayerView[];
  onRestart: () => void;
}) {
  const crewWon = result?.winner === "crew";

  return (
    <View style={styles.container}>
      <DoodleCard style={styles.card}>
        {/* Winner banner — 가로 화면 세로 예산이 좁아 아이콘+타이틀을 한 행으로 압축 */}
        <View style={styles.banner}>
          <View style={styles.bannerRow}>
            {!result ? (
              <Flag color={colors.ink} size={30} strokeWidth={2} />
            ) : crewWon ? (
              <PartyPopper color={colors.accent} size={30} strokeWidth={2} />
            ) : (
              <Skull color={colors.accent} size={30} strokeWidth={2} />
            )}
            <Text style={[styles.bannerTitle, { color: crewWon ? colors.ink : colors.accent }]}>
              {!result ? "게임 종료" : crewWon ? "크루메이트 승리!" : "AI 승리!"}
            </Text>
          </View>
          {result ? <Text style={styles.bannerReason}>{REASON_LABELS[result.reason]}</Text> : null}
        </View>

        {/* Player reveal list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>플레이어 역할 공개</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {players.map((p) => (
              <View key={p.profileId} style={styles.playerRow}>
                {p.isAi ? (
                  <Bot color={colors.accent} size={20} strokeWidth={2.2} />
                ) : (
                  <Wrench color={colors.grayDark} size={20} strokeWidth={2.2} />
                )}
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{p.name}</Text>
                  <Text
                    style={[styles.roleLabel, { color: p.isAi ? colors.accent : colors.grayMid }]}
                  >
                    {p.isAi ? "AI" : "크루메이트"}
                    {!p.alive ? " · 탈락" : ""}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        <DoodleButton title="다시하기" onPress={onRestart} variant="primary" />
      </DoodleCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12 },
  // alignSelf: ShadowBox 기본 stretch가 부모 alignItems를 무시하므로 center 명시 필수.
  // flex:1 금지 — WobbleBox 내부 flex 체인이 없어 콘텐츠 자연 높이로 오버플로하면
  // 다시하기 버튼이 가로 화면(높이 ~390) 밖으로 밀린다. 콘텐츠 예산(리스트 maxHeight)로 제어.
  card: { width: "100%", maxWidth: 560, alignSelf: "center" },
  banner: {
    alignItems: "center",
    paddingVertical: 6,
    marginBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.grayLight,
    gap: 4,
  },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  bannerTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  bannerReason: {
    fontSize: 13,
    color: colors.grayMid,
  },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.grayDark,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  list: { maxHeight: 150 },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 16, color: colors.ink, fontWeight: "600" },
  roleLabel: { fontSize: 12, marginTop: 2 },
});
