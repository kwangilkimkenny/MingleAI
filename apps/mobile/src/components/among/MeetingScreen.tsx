/**
 * MeetingScreen — shown when among.phase === "meeting" | "voting".
 * Displays reason, countdown, participant list, and vote buttons.
 */
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Check, Siren, Skull, Vote } from "lucide-react-native";
import type { AmongSnapshot } from "@mingle/shared";
import { colors, doodle, space, type } from "../../lib/theme";
import { DoodleButton } from "../Doodle";
import { WobbleBox } from "../DoodleSvg";
import { hapticImpact, hapticSelect } from "../../lib/haptics";
import { useInitialAccessibilityFocus } from "../../lib/accessibility";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function MeetingScreen({
  snapshot,
  myProfileId,
  onVote,
}: {
  snapshot: AmongSnapshot;
  myProfileId: string;
  onVote: (target: string) => void;
}) {
  const meeting = snapshot.meeting!;
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.floor((meeting.endsAt - Date.now()) / 1000)),
  );
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const { width } = useWindowDimensions();
  const wideVoting = width >= 700;
  const focusRef = useInitialAccessibilityFocus(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.floor((meeting.endsAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [meeting.endsAt]);

  useEffect(() => {
    setSelectedTarget(null);
    setVoteSubmitted(false);
  }, [meeting.endsAt]);

  const isVoting = meeting.phase === "voting";
  const alreadyVoted = meeting.votedProfileIds.includes(myProfileId);
  const icon =
    meeting.reason === "emergency" ? (
      <Siren color={colors.warning} size={20} strokeWidth={2.2} />
    ) : meeting.reason === "auto" ? (
      <Vote color={colors.ink} size={20} strokeWidth={2.2} />
    ) : (
      <Skull color={colors.danger} size={20} strokeWidth={2.2} />
    );
  const reasonText =
    meeting.reason === "emergency"
      ? "긴급 회의"
      : meeting.reason === "auto"
        ? "정기 투표"
        : "시체 신고";

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: space.x2 + insets.top,
          paddingRight: space.x3 + insets.right,
          paddingBottom: space.x2 + insets.bottom,
          paddingLeft: space.x3 + insets.left,
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
        {/* Header */}
        <View style={styles.header}>
          <View
            ref={focusRef}
            style={styles.reasonRow}
            accessible
            accessibilityLabel={`${reasonText}, ${isVoting ? "투표 단계" : "토론 단계"}, ${secondsLeft}초 남음`}
          >
            {icon}
            <Text accessibilityRole="header" style={styles.reasonText}>{reasonText}</Text>
          </View>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{secondsLeft}s</Text>
          </View>
        </View>

        {/* Phase label */}
        <Text accessibilityLiveRegion="polite" style={styles.phaseLabel}>
          {isVoting ? "투표 단계 · 한 번 확인하면 바꿀 수 없어요" : "토론 중 · 채팅에서 근거를 나눠보세요"}
        </Text>

        {/* Discussion phase: participant list */}
        {!isVoting && (
          <ScrollView style={styles.list} showsVerticalScrollIndicator>
            {snapshot.players.map((p) => (
              <View key={p.profileId} style={styles.playerRow}>
                <View
                  style={[styles.dot, { backgroundColor: p.alive ? colors.ink : colors.grayLight }]}
                />
                <Text
                  style={[
                    styles.playerName,
                    !p.alive && styles.deadName,
                    p.profileId === myProfileId && styles.myName,
                  ]}
                >
                  {p.name}
                  {!p.alive ? " (사망)" : ""}
                  {p.profileId === myProfileId ? " (나)" : ""}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Voting phase: vote buttons */}
        {isVoting && (
          <ScrollView
            style={styles.list}
            contentContainerStyle={[styles.voteGrid, width < 520 && styles.voteGridNarrow]}
            showsVerticalScrollIndicator
            accessibilityRole="radiogroup"
          >
            {[
              ...snapshot.players.filter((p) => p.alive).map((p) => ({
                profileId: p.profileId,
                label: `${p.name}${p.profileId === myProfileId ? " (나)" : ""}`,
                hasVoted: meeting.votedProfileIds.includes(p.profileId),
              })),
              { profileId: "skip", label: "스킵", hasVoted: false },
            ].map((candidate) => {
              const selected = selectedTarget === candidate.profileId;
              return (
                  <Pressable
                    key={candidate.profileId}
                    onPress={() => {
                      hapticSelect();
                      setSelectedTarget(candidate.profileId);
                    }}
                    disabled={alreadyVoted || voteSubmitted}
                    accessibilityRole="radio"
                    accessibilityLabel={`${candidate.label}${candidate.hasVoted ? ", 투표 완료" : ""}`}
                    accessibilityState={{
                      checked: selected,
                      disabled: alreadyVoted || voteSubmitted,
                    }}
                    style={({ pressed }) => [
                      styles.voteCandidate,
                      wideVoting && styles.voteCandidateWide,
                      width < 520 && styles.voteCandidateNarrow,
                      selected && styles.voteCandidateSelected,
                      pressed && styles.voteCandidatePressed,
                    ]}
                  >
                    <View style={[styles.candidateMark, selected && styles.candidateMarkSelected]}>
                      {selected ? <Check size={15} color={colors.onAccent} strokeWidth={3} /> : null}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.candidateName, selected && styles.candidateNameSelected]}
                    >
                      {candidate.label}
                    </Text>
                    {candidate.hasVoted ? <Text style={styles.votedMark}>완료</Text> : null}
                  </Pressable>
              );
            })}
          </ScrollView>
        )}

        {isVoting && !alreadyVoted && !voteSubmitted ? (
          <View style={styles.confirmVote}>
            <DoodleButton
              title={selectedTarget ? "이 선택으로 투표하기" : "투표할 대상을 선택하세요"}
              variant="primary"
              serious
              disabled={!selectedTarget}
              onPress={() => {
                if (!selectedTarget) return;
                hapticImpact();
                setVoteSubmitted(true);
                onVote(selectedTarget);
              }}
            />
          </View>
        ) : null}

        {/* Vote status */}
        {isVoting && (
          <Text accessibilityLiveRegion="polite" style={styles.voteStatus}>
            {meeting.votedProfileIds.length}명 투표 완료
            {alreadyVoted || voteSubmitted ? " · 투표 완료" : " · 투표하세요"}
          </Text>
        )}
      </WobbleBox>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center" },
  // alignSelf: ShadowBox 기본 stretch가 부모 alignItems를 무시하므로 center 명시 필수
  card: {
    flex: 1,
    width: "100%",
    maxWidth: 560,
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  reasonText: { ...type.title, color: colors.ink },
  timerBadge: {
    backgroundColor: colors.warningFill,
    borderWidth: 1.5,
    borderColor: colors.warning,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timerText: {
    color: colors.ink,
    ...type.label,
    fontVariant: ["tabular-nums"],
  },
  phaseLabel: {
    ...type.caption,
    color: colors.grayDark,
    marginBottom: space.x3,
  },
  list: { flex: 1, minHeight: 0, marginBottom: 8 },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  playerName: { ...type.body, color: colors.ink },
  deadName: { color: colors.grayMid, textDecorationLine: "line-through" },
  myName: { fontWeight: "700" },
  voteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingBottom: space.x2,
  },
  voteGridNarrow: { flexDirection: "column", flexWrap: "nowrap" },
  voteCandidate: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: space.x2,
    paddingHorizontal: space.x3,
    backgroundColor: colors.paper,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    ...doodle.radius.button,
  },
  voteCandidateWide: { flexBasis: "31%" },
  voteCandidateNarrow: { flexBasis: "auto", flexGrow: 0, width: "100%" },
  voteCandidateSelected: { backgroundColor: colors.accent, borderColor: colors.ink },
  voteCandidatePressed: { opacity: 0.72 },
  candidateMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.grayMid,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  candidateMarkSelected: { backgroundColor: colors.accentDeep, borderColor: colors.onAccent },
  candidateName: { ...type.label, color: colors.ink, flex: 1, minWidth: 0 },
  candidateNameSelected: { color: colors.onAccent },
  votedMark: { ...type.caption, fontFamily: "Pretendard_600SemiBold", color: colors.success },
  confirmVote: { marginTop: space.x2 },
  voteStatus: {
    textAlign: "center",
    ...type.caption,
    color: colors.grayDark,
    marginTop: 4,
  },
});
