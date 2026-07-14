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
import { DashedLine, DoodleFace } from "../../../src/components/DoodleSvg";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { colors, fonts } from "../../../src/lib/theme";

const Separator = () => (
  <View style={styles.separatorWrap}>
    <DashedLine />
  </View>
);

export default function Chats() {
  const clearance = useTabBarClearance();
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
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.appbar}>
        <Text style={styles.title}>채팅</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {rooms.length === 0 ? (
        <View style={styles.center}>
          <DoodleFace variant="flat" size={64} />
          <Text style={styles.empty}>아직 매칭된 상대가 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.roomId}
          contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
          ItemSeparatorComponent={Separator}
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
  container: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  appbar: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  list: { paddingVertical: 8 },
  // Old separator was full-bleed with no horizontal margin — the wrap keeps that (100% width
  // also gives the DashedLine Svg's percentage width a definite parent).
  separatorWrap: { width: "100%" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLeft: { flex: 1 },
  peerName: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  lastMsg: { fontSize: 12.5, color: colors.grayMid, marginTop: 2 },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: colors.onAccent, fontSize: 11, fontWeight: "700" },
  empty: { fontSize: 15, color: colors.grayMid },
  error: { color: colors.ink, textAlign: "center", margin: 12 },
});
