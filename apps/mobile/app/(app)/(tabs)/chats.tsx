import { useCallback, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getMatches, ApiError, type MatchSummary } from "@mingle/client-core";
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";
import { EnterRow } from "../../../src/components/Motion";
import { AppScreen } from "../../../src/components/AppScreen";
import { ListRow, RowSeparator } from "../../../src/components/ListRow";
import { StateView } from "../../../src/components/Foundation";
import { colors, fonts, space, type } from "../../../src/lib/theme";

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

  return (
    <AppScreen tabScreen header={{ title: "채팅" }} body="plain">
      {loading ? (
        <StateView title="대화를 불러오고 있어요" loading />
      ) : error ? (
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
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <RowSeparator gutter={0} />}
          renderItem={({ item, index }) => (
            <EnterRow index={index}>
              <ListRow
                gutter={0}
                leading={<DoodleAvatar uri={item.peer.photoUrl} name={item.peer.name} size={46} />}
                title={item.peer.name}
                subtitle={item.lastMessage?.content ?? "메시지를 보내보세요"}
                trailing={
                  item.unreadCount > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unreadCount}</Text>
                    </View>
                  ) : (
                    <View />
                  )
                }
                onPress={() =>
                  router.push({ pathname: "/(app)/chat/[roomId]", params: { roomId: item.roomId } })
                }
                accessibilityLabel={`${item.peer.name}님과의 채팅${item.unreadCount > 0 ? `, 읽지 않은 메시지 ${item.unreadCount}개` : ""}`}
              />
            </EnterRow>
          )}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { paddingTop: space.x1 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.accentStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { ...type.caption, color: colors.onAccent, fontFamily: fonts.bodySemibold },
});
