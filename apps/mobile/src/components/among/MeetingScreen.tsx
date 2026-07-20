/**
 * MeetingScreen — shown when among.phase === "meeting" | "voting".
 * Displays reason, countdown, participant list, and vote buttons.
 */
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Siren, Skull, Vote } from "lucide-react-native";
import type { AmongSnapshot } from "@mingle/shared";
import { colors, fonts } from "../../lib/theme";
import { DoodleButton, DoodleCard } from "../Doodle";

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

  useEffect(() => {
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.floor((meeting.endsAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [meeting.endsAt]);

  const isVoting = meeting.phase === "voting";
  const alreadyVoted = meeting.votedProfileIds.includes(myProfileId);
  const icon =
    meeting.reason === "emergency" ? (
      <Siren color={colors.accent} size={20} strokeWidth={2.2} />
    ) : meeting.reason === "auto" ? (
      <Vote color={colors.ink} size={20} strokeWidth={2.2} />
    ) : (
      <Skull color={colors.ink} size={20} strokeWidth={2.2} />
    );
  const reasonText =
    meeting.reason === "emergency"
      ? "긴급 회의"
      : meeting.reason === "auto"
        ? "정기 투표"
        : "시체 신고";

  return (
    <View style={styles.container}>
      <DoodleCard style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.reasonRow}>
            {icon}
            <Text style={styles.reasonText}>{reasonText}</Text>
          </View>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{secondsLeft}s</Text>
          </View>
        </View>

        {/* Phase label */}
        <Text style={styles.phaseLabel}>{isVoting ? "투표 단계" : "토론 중"}</Text>

        {/* Discussion phase: participant list */}
        {!isVoting && (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
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
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {snapshot.players
              .filter((p) => p.alive)
              .map((p) => {
                const hasVoted = meeting.votedProfileIds.includes(p.profileId);
                return (
                  <View key={p.profileId} style={styles.voteRow}>
                    <DoodleButton
                      title={`${p.name}${p.profileId === myProfileId ? " (나)" : ""}${hasVoted ? " ✓" : ""}`}
                      onPress={() => onVote(p.profileId)}
                      disabled={alreadyVoted}
                      style={styles.voteButton}
                    />
                  </View>
                );
              })}
            <View style={styles.voteRow}>
              <DoodleButton
                title={`스킵${alreadyVoted ? " ✓" : ""}`}
                onPress={() => onVote("skip")}
                disabled={alreadyVoted}
                style={styles.voteButton}
              />
            </View>
          </ScrollView>
        )}

        {/* Vote status */}
        {isVoting && (
          <Text style={styles.voteStatus}>
            {meeting.votedProfileIds.length}명 투표 완료
            {alreadyVoted ? " · 투표 완료" : " · 투표하세요"}
          </Text>
        )}
      </DoodleCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center" },
  // alignSelf: ShadowBox 기본 stretch가 부모 alignItems를 무시하므로 center 명시 필수
  card: { flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  reasonText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
  },
  timerBadge: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timerText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  phaseLabel: {
    fontSize: 13,
    color: colors.grayMid,
    marginBottom: 12,
  },
  list: { maxHeight: 160, marginBottom: 8 },
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
  playerName: { fontSize: 15, color: colors.ink },
  deadName: { color: colors.grayMid, textDecorationLine: "line-through" },
  myName: { fontWeight: "700" },
  voteRow: { marginBottom: 8 },
  voteButton: {},
  voteStatus: {
    textAlign: "center",
    fontSize: 12,
    color: colors.grayMid,
    marginTop: 4,
  },
});
