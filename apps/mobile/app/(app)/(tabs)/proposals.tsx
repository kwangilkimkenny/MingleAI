import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import {
  getReceivedProposals,
  acceptProposal,
  declineProposal,
  ApiError,
  type ProposalView,
} from "@mingle/client-core";
import { PeerModerationMenu } from "../../../src/components/PeerModerationMenu";
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";
import { DoodleCard } from "../../../src/components/Doodle";
import { DashedLine, DoodleFace } from "../../../src/components/DoodleSvg";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { colors, doodle, fonts } from "../../../src/lib/theme";

export default function Proposals() {
  const clearance = useTabBarClearance();
  const [proposals, setProposals] = useState<ProposalView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    getReceivedProposals()
      .then((list) => {
        if (!alive.current) return;
        setProposals(list.filter((p) => p.status === "pending"));
        setLoading(false);
      })
      .catch((e) => {
        if (!alive.current) return;
        setError(e instanceof ApiError ? e.message : "불러오기 실패");
        setLoading(false);
      });
    return () => {
      alive.current = false;
    };
  }, []);

  async function onAccept(id: string) {
    try {
      const res = await acceptProposal(id);
      if (!alive.current) return;
      setProposals((prev) => prev.filter((p) => p.id !== id));
      router.push({ pathname: "/(app)/chat/[roomId]", params: { roomId: res.roomId } });
    } catch (e) {
      if (alive.current) setError(e instanceof ApiError ? e.message : "수락 실패");
    }
  }

  async function onDecline(id: string) {
    try {
      await declineProposal(id);
      if (!alive.current) return;
      setProposals((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      if (alive.current) setError(e instanceof ApiError ? e.message : "거절 실패");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.appbar}>
        <Text style={styles.title}>프로포즈</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {proposals.length === 0 ? (
        <View style={styles.center}>
          <DoodleFace variant="flat" size={64} />
          <Text style={styles.empty}>받은 프로포즈가 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={proposals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
          renderItem={({ item }) => (
            <DoodleCard tone="paper" contentStyle={styles.cardInner}>
              <View style={styles.cardHeader}>
                <PeerModerationMenu
                  peer={{ profileId: item.peer.profileId, name: item.peer.name }}
                  onBlocked={() => setProposals((prev) => prev.filter((p) => p.id !== item.id))}
                />
              </View>
              <View style={styles.peerInfo}>
                <DoodleAvatar uri={item.peer.photoUrl} name={item.peer.name} size={54} />
                <View style={styles.peerText}>
                  <Text style={styles.name}>
                    {item.peer.name} · {item.peer.age}
                  </Text>
                  <Text style={styles.meta}>{item.peer.occupation}</Text>
                  {item.peer.preferenceSummary ? (
                    <Text style={styles.summary}>{item.peer.preferenceSummary}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.divider}>
                <DashedLine />
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(item.id)}>
                  <Text style={styles.acceptText}>수락</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineBtn} onPress={() => onDecline(item.id)}>
                  <Text style={styles.declineText}>거절</Text>
                </TouchableOpacity>
              </View>
            </DoodleCard>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  appbar: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  list: { padding: 16, gap: 12 },
  cardInner: { padding: 14 },
  cardHeader: { alignItems: "flex-end" },
  peerInfo: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  peerText: { flex: 1 },
  name: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  meta: { fontSize: 12.5, color: colors.grayMid, marginTop: 2 },
  summary: { fontSize: 12.5, color: colors.grayMid, marginTop: 4 },
  // SVG dashed hairline wrap (RN single-side dashed borders are broken natively); keeps the
  // 12px gap the old border-divider had before the action row.
  divider: { width: "100%", marginBottom: 12 },
  actions: { flexDirection: "row", gap: 8 },
  acceptBtn: {
    flex: 1,
    // 수락 = 이 화면의 primary 액션 — 팔레트 규칙상 잉크 블록이 아닌 코랄 포인트.
    backgroundColor: colors.accent,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    ...doodle.radius.button,
    paddingVertical: 10,
    alignItems: "center",
  },
  acceptText: { color: colors.onAccent, fontFamily: fonts.display, fontSize: 15 },
  declineBtn: {
    flex: 1,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  declineText: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  empty: { fontSize: 15, color: colors.grayMid },
  error: { color: colors.ink, textAlign: "center", margin: 12 },
});
