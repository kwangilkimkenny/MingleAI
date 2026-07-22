/**
 * ResultScreen — shown when among.phase === "ended".
 * Reveals the result, then returns the player to the social loop instead of ending at a score.
 */
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Bot, Flag, HeartHandshake, PartyPopper, Skull, Sparkles, Wrench } from "lucide-react-native";
import type { AmongResultView, AmongSnapshot, GameReveal } from "@mingle/shared";
import { colors, doodle, fonts, space, type } from "../../lib/theme";
import { DoodleButton } from "../Doodle";
import { WobbleBox } from "../DoodleSvg";
import { strongestBalanceConnection } from "../../lib/social-highlights";
import { hapticSuccess, hapticWarning } from "../../lib/haptics";
import { useInitialAccessibilityFocus } from "../../lib/accessibility";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const REASON_LABELS: Record<AmongResultView["reason"], string> = {
  tasks: "모든 미션 완료",
  ejected: "AI 전원 추방",
  kills: "크루메이트 전멸",
};

export function ResultScreen({
  snapshot,
  balanceReveals,
  onRestart,
  onLobby,
}: {
  snapshot: AmongSnapshot;
  balanceReveals: GameReveal[];
  onRestart: () => void;
  onLobby: () => void;
}) {
  // null when the game was force-ended (among:end) with no winner decided.
  const result: AmongResultView | null = snapshot.result;
  const players = snapshot.players;
  const crewWon = result?.winner === "crew";
  const winner = result?.winner ?? null;
  const humanCount = players.filter((player) => !player.isAi).length;
  const aliveHumanCount = players.filter((player) => !player.isAi && player.alive).length;
  const me = players.find((player) => player.profileId === snapshot.myProfileId);
  const ownTasksDone = snapshot.myTasks.filter((task) => task.done).length;
  const balanceConnection = strongestBalanceConnection(
    balanceReveals,
    snapshot.myProfileId,
    players.filter((player) => !player.isAi),
  );
  const ejected = snapshot.lastEjected
    ? players.find((player) => player.profileId === snapshot.lastEjected?.profileId)
    : null;
  const focusRef = useInitialAccessibilityFocus(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (winner === "crew") hapticSuccess();
    else if (winner === "impostor") hapticWarning();
  }, [winner]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: 12 + insets.top,
          paddingRight: 12 + insets.right,
          paddingBottom: 12 + insets.bottom,
          paddingLeft: 12 + insets.left,
        },
      ]}
    >
      <WobbleBox
        radius={doodle.radius.card}
        bg={colors.paper}
        stroke={colors.ink}
        style={styles.card}
        contentStyle={styles.cardContent}
      >
        {/* Winner banner — 가로 화면 세로 예산이 좁아 아이콘+타이틀을 한 행으로 압축 */}
        <View
          ref={focusRef}
          style={styles.banner}
          accessible
          accessibilityLabel={`${!result ? "게임 종료" : crewWon ? "크루메이트 승리" : "AI 승리"}${result ? `, ${REASON_LABELS[result.reason]}` : ""}`}
        >
          <View style={styles.bannerRow}>
            {!result ? (
              <Flag color={colors.ink} size={30} strokeWidth={2} />
            ) : crewWon ? (
              <PartyPopper color={colors.success} size={30} strokeWidth={2} />
            ) : (
              <Skull color={colors.danger} size={30} strokeWidth={2} />
            )}
            <Text accessibilityRole="header" style={[styles.bannerTitle, { color: !result ? colors.ink : crewWon ? colors.success : colors.danger }]}>
              {!result ? "게임 종료" : crewWon ? "크루메이트 승리!" : "AI 승리!"}
            </Text>
          </View>
          {result ? <Text style={styles.bannerReason}>{REASON_LABELS[result.reason]}</Text> : null}
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator
          contentContainerStyle={styles.scrollContent}
        >
        <Text style={styles.sectionTitle}>우리 사이에 남은 기록</Text>
        <View style={styles.insightGrid}>
          {balanceConnection ? (
            <View style={styles.insightCard}>
              <View style={styles.insightTitleRow}>
                <HeartHandshake color={colors.accent} size={20} strokeWidth={2.3} />
                <Text style={styles.insightLabel}>취향이 가장 많이 겹친 멤버</Text>
              </View>
              <Text style={styles.insightValue}>{balanceConnection.peerName}</Text>
              <Text style={styles.insightBody}>
                함께 답한 {balanceConnection.answeredRounds}개 중 {balanceConnection.sharedCount}개 선택이 같았어요.
              </Text>
              <Text style={styles.choiceChip} numberOfLines={1}>같이 고른 답 · {balanceConnection.latestSharedChoice}</Text>
            </View>
          ) : null}
          <View style={styles.insightCard}>
            <View style={styles.insightTitleRow}>
              <Sparkles color={colors.success} size={20} strokeWidth={2.3} />
              <Text style={styles.insightLabel}>이번 게임에서 함께 만든 장면</Text>
            </View>
            <Text style={styles.insightValue}>
              내 미션 {ownTasksDone}/{snapshot.myTasks.length} 완료
            </Text>
            <Text style={styles.insightBody}>
              사람 멤버 {humanCount}명과 플레이했고 {aliveHumanCount}명이 마지막까지 남았어요
              {me && !me.alive ? " · 나는 관전으로 끝까지 함께했어요." : "."}
            </Text>
            {ejected ? (
              <Text style={styles.evidenceText} numberOfLines={2}>
                마지막 추방 · {ejected.name} ({snapshot.lastEjected?.role === "impostor" ? "AI" : "크루메이트"})
              </Text>
            ) : null}
          </View>
        </View>

        {/* Player reveal list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>함께 플레이한 멤버</Text>
          <View style={styles.list}>
            {players.map((p) => (
              <View key={p.profileId} style={styles.playerRow}>
                {p.isAi ? (
                  <Bot color={colors.danger} size={20} strokeWidth={2.2} />
                ) : (
                  <Wrench color={colors.grayDark} size={20} strokeWidth={2.2} />
                )}
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{p.name}</Text>
                  <Text
                    style={[styles.roleLabel, { color: p.isAi ? colors.danger : colors.grayDark }]}
                  >
                    {p.isAi ? "AI" : "크루메이트"}
                    {!p.alive ? " · 탈락" : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.nextCopy}>
          위 기록 중 하나를 골라 로비에서 바로 이야기해 보세요.
        </Text>
        </ScrollView>
        <View style={styles.actions}>
          <DoodleButton
            title="로비에서 대화하기"
            onPress={onLobby}
            variant="primary"
            style={styles.action}
          />
          <DoodleButton title="다시하기" onPress={onRestart} style={styles.action} />
        </View>
      </WobbleBox>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12 },
  // alignSelf: ShadowBox 기본 stretch가 부모 alignItems를 무시하므로 center 명시 필수.
  // flex:1 금지 — WobbleBox 내부 flex 체인이 없어 콘텐츠 자연 높이로 오버플로하면
  // 다시하기 버튼이 가로 화면(높이 ~390) 밖으로 밀린다. 콘텐츠 예산(리스트 maxHeight)로 제어.
  card: {
    width: "100%",
    maxWidth: 560,
    height: "96%",
    minHeight: 0,
    alignSelf: "center",
    overflow: "hidden",
  },
  cardContent: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    padding: space.x4,
    zIndex: 1,
  },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: space.x2 },
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
  bannerReason: { ...type.caption, color: colors.grayDark },
  insightGrid: { gap: space.x2, marginBottom: space.x3 },
  insightCard: {
    gap: space.x1,
    padding: space.x3,
    backgroundColor: colors.fill,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grayLight,
  },
  insightTitleRow: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  insightLabel: { ...type.caption, fontFamily: fonts.bodySemibold, color: colors.grayDark, flex: 1 },
  insightValue: { ...type.label, color: colors.ink },
  insightBody: { ...type.caption, color: colors.grayDark },
  choiceChip: {
    ...type.caption,
    fontFamily: fonts.bodySemibold,
    color: colors.accentDeep,
    alignSelf: "flex-start",
    marginTop: space.x1,
  },
  evidenceText: { ...type.caption, fontFamily: fonts.bodySemibold, color: colors.ink, marginTop: space.x1 },
  section: { marginBottom: 12 },
  sectionTitle: {
    ...type.label,
    color: colors.grayDark,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  list: { flexDirection: "row", flexWrap: "wrap", columnGap: space.x4 },
  playerRow: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  playerInfo: { flex: 1 },
  playerName: { ...type.body, fontFamily: fonts.bodySemibold, color: colors.ink },
  roleLabel: { ...type.caption, marginTop: 2 },
  nextCopy: { ...type.caption, color: colors.grayDark, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 8, paddingTop: space.x2 },
  action: { flex: 1 },
});
