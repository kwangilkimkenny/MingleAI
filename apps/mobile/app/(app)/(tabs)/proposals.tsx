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

const INK = "#17150F";
const PAPER = "#FFFFFF";
const GRAY_MED = "#8A857C";
const GRAY_DARK = "#45413A";

export default function Proposals() {
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
        <ActivityIndicator size="large" color={INK} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {proposals.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>받은 프로포즈가 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={proposals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <PeerModerationMenu
                  peer={{ profileId: item.peer.profileId, name: item.peer.name }}
                  onBlocked={() => setProposals((prev) => prev.filter((p) => p.id !== item.id))}
                />
              </View>
              <View style={styles.peerInfo}>
                <Text style={styles.name}>
                  {item.peer.name} · {item.peer.age}
                </Text>
                <Text style={styles.meta}>{item.peer.occupation}</Text>
                {item.peer.preferenceSummary ? (
                  <Text style={styles.summary}>{item.peer.preferenceSummary}</Text>
                ) : null}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(item.id)}>
                  <Text style={styles.acceptText}>수락</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineBtn} onPress={() => onDecline(item.id)}>
                  <Text style={styles.declineText}>거절</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 12 },
  card: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 12,
    padding: 14,
    backgroundColor: PAPER,
    shadowColor: INK,
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  cardHeader: { alignItems: "flex-end" },
  peerInfo: { marginBottom: 12 },
  name: { fontSize: 16, fontWeight: "700", color: INK },
  meta: { fontSize: 13, color: GRAY_DARK, marginTop: 2 },
  summary: { fontSize: 13, color: GRAY_MED, marginTop: 4 },
  actions: { flexDirection: "row", gap: 8 },
  acceptBtn: {
    flex: 1,
    backgroundColor: INK,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  acceptText: { color: PAPER, fontWeight: "700", fontSize: 14 },
  declineBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  declineText: { color: INK, fontWeight: "700", fontSize: 14 },
  empty: { fontSize: 15, color: GRAY_MED },
  error: { color: INK, textAlign: "center", margin: 12 },
});
