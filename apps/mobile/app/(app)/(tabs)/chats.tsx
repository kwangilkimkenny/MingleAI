import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getMatches, ApiError, type MatchSummary } from "@mingle/client-core";
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";

const INK = "#17150F";
const PAPER = "#FFFFFF";
const ACCENT = "#C2185B"; // dark-pink point color (unread badge)
const GRAY_LIGHT = "#D9D5CC";
const GRAY_MED = "#8A857C";

export default function Chats() {
  const [rooms, setRooms] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(() => {
    alive.current = true;
    setLoading(true);
    setError(null);
    getMatches()
      .then((list) => {
        if (!alive.current) return;
        setRooms(list);
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

  useFocusEffect(load);

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
      {rooms.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>아직 매칭된 상대가 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.roomId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                router.push({ pathname: "/(app)/chat/[roomId]", params: { roomId: item.roomId } })
              }
            >
              <DoodleAvatar uri={item.peer.photoUrl} name={item.peer.name} size={46} />
              <View style={styles.rowLeft}>
                <Text style={styles.peerName}>{item.peer.name}</Text>
                <Text style={styles.lastMsg} numberOfLines={1}>
                  {item.lastMessage?.content ?? "메시지를 보내보세요"}
                </Text>
              </View>
              {item.unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { paddingVertical: 8, paddingBottom: 84 }, // clears the floating doodle tab bar
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_LIGHT,
  },
  rowLeft: { flex: 1 },
  peerName: { fontSize: 15, fontWeight: "700", color: INK },
  lastMsg: { fontSize: 13, color: GRAY_MED, marginTop: 2 },
  badge: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: PAPER, fontSize: 11, fontWeight: "700" },
  empty: { fontSize: 15, color: GRAY_MED },
  error: { color: INK, textAlign: "center", margin: 12 },
});
