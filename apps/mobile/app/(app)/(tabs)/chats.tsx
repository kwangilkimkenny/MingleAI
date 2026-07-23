import { useCallback, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getMatches, ApiError, type MatchSummary } from "@mingle/client-core";
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";
import { DashedLine } from "../../../src/components/DoodleSvg";
import { EnterRow } from "../../../src/components/Motion";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { colors, layout, space, type } from "../../../src/lib/theme";
import { ContentColumn, PageHeader, StateView } from "../../../src/components/Foundation";

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
    return <StateView title="대화를 불러오고 있어요" loading />;
  }

  return (
    <View style={styles.container}>
      {error ? (
        <StateView
          title="대화를 불러오지 못했어요"
          body={error}
          actionLabel="다시 시도"
          onAction={load}
        />
      ) : rooms.length === 0 ? (
        <StateView
          title="아직 열린 대화가 없어요"
          body="블라인드 데이트에서 만나 서로 선택하면 1:1 채팅이 여기에 열려요."
          actionLabel="블라인드 데이트 시작"
          onAction={() => router.push("/(app)/speed-date")}
        />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.roomId}
          contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
          ItemSeparatorComponent={Separator}
          renderItem={({ item, index }) => (
            <EnterRow index={index}>
              <TouchableOpacity
                style={styles.row}
                onPress={() =>
                  router.push({ pathname: "/(app)/chat/[roomId]", params: { roomId: item.roomId } })
                }
                accessibilityRole="button"
                accessibilityLabel={`${item.peer.name}님과의 채팅${item.unreadCount > 0 ? `, 읽지 않은 메시지 ${item.unreadCount}개` : ""}`}
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
            </EnterRow>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  headerColumn: { paddingHorizontal: layout.screenGutter },
  list: {
    width: "100%",
    maxWidth: layout.contentMax,
    alignSelf: "center",
    paddingVertical: space.x2,
  },
  // Old separator was full-bleed with no horizontal margin — the wrap keeps that (100% width
  // also gives the DashedLine Svg's percentage width a definite parent).
  separatorWrap: { width: "100%" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    minHeight: 72,
    paddingVertical: space.x3,
    paddingHorizontal: layout.screenGutter,
  },
  rowLeft: { flex: 1 },
  peerName: { ...type.heading, fontSize: 18, lineHeight: 23, color: colors.ink },
  lastMsg: { ...type.caption, color: colors.grayDark, marginTop: space.x1 },
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
});
