import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getMatches, ApiError, type MatchSummary } from "@mingle/client-core";
import { Search, X } from "lucide-react-native";
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";
import { EnterRow } from "../../../src/components/Motion";
import { AppScreen } from "../../../src/components/AppScreen";
import { messagePreview } from "../../../src/lib/chat-preview";
import { DoodleButton } from "../../../src/components/Doodle";
import { StateView } from "../../../src/components/Foundation";
import { colors, control, dark, fonts, space, type } from "../../../src/lib/theme";

function formatChatTime(value?: string): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (dayDifference === 0) {
    return date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  }
  if (dayDifference === 1) return "어제";
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  }
  return `${String(date.getFullYear()).slice(2)}.${date.getMonth() + 1}.${date.getDate()}`;
}



export default function Chats() {
  const [rooms, setRooms] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
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

  const visibleRooms = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko-KR");
    if (!keyword) return rooms;
    return rooms.filter((item) => {
      const searchable = `${item.peer.name} ${messagePreview(item.lastMessage)}`.toLocaleLowerCase("ko-KR");
      return searchable.includes(keyword);
    });
  }, [query, rooms]);

  const searchAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={searchOpen ? "채팅 검색 닫기" : "채팅 검색"}
      onPress={() => {
        setSearchOpen((open) => !open);
        if (searchOpen) setQuery("");
      }}
      hitSlop={4}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      {searchOpen ? (
        <X color={dark.text} size={24} strokeWidth={2} />
      ) : (
        <Search color={dark.text} size={23} strokeWidth={2} />
      )}
    </Pressable>
  );

  return (
    <AppScreen
      tabScreen
      tone="dark"
      body="plain"
      header={{ action: searchAction }}
    >
      {searchOpen ? (
        <View style={styles.searchBar}>
          <Search color={dark.textMuted} size={18} strokeWidth={2} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="이름 또는 메시지 검색"
            placeholderTextColor={dark.textMuted}
            returnKeyType="search"
            accessibilityLabel="채팅 검색어"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="검색어 지우기"
              onPress={() => setQuery("")}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View style={styles.clearButton}>
                <X color={dark.onPill} size={12} strokeWidth={2.5} />
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <StateView title="대화를 불러오고 있어요" loading dark />
      ) : error ? (
        <StateView
          title="대화를 불러오지 못했어요"
          body={error}
          actionLabel="다시 시도"
          onAction={load}
          dark
        />
      ) : rooms.length === 0 ? (
        // CTA는 하단 고정 — 빈 상태에서도 primary 액션은 썸존에 둔다(2026-07-27 감사).
        <View style={styles.emptyWrap}>
          <StateView
            title="아직 열린 대화가 없어요"
            body="블라인드 데이트에서 서로를 선택하면 1:1 채팅이 여기에 열려요."
            dark
          />
          <View style={styles.emptyCta}>
            <DoodleButton
              title="블라인드 데이트 시작"
              variant="primary"
              tone="dark"
              onPress={() => router.push("/(app)/speed-date")}
            />
          </View>
        </View>
      ) : visibleRooms.length === 0 ? (
        <View style={styles.noResults} accessibilityLiveRegion="polite">
          <View style={styles.noResultsIcon}>
            <Search color={dark.textMuted} size={27} strokeWidth={1.75} />
          </View>
          <Text style={styles.noResultsTitle}>검색 결과가 없어요</Text>
          <Text style={styles.noResultsBody}>다른 이름이나 메시지를 입력해 보세요.</Text>
        </View>
      ) : (
        <FlatList
          data={visibleRooms}
          keyExtractor={(item) => item.roomId}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item, index }) => (
            <EnterRow index={index}>
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/(app)/chat/[roomId]", params: { roomId: item.roomId } })
                }
                accessibilityRole="button"
                accessibilityLabel={`${item.peer.name}님과의 채팅${item.unreadCount > 0 ? `, 읽지 않은 메시지 ${item.unreadCount}개` : ""}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <DoodleAvatar
                  dark
                  uri={item.peer.photoUrl}
                  name={item.peer.name}
                  size={52}
                />
                <View style={styles.rowContent}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.peer.name}
                    </Text>
                    <Text style={styles.time}>{formatChatTime(item.lastMessage?.createdAt)}</Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text
                      style={[styles.preview, item.unreadCount > 0 && styles.previewUnread]}
                      numberOfLines={1}
                    >
                      {messagePreview(item.lastMessage)}
                    </Text>
                    {item.unreadCount > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {item.unreadCount > 99 ? "99+" : item.unreadCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            </EnterRow>
          )}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  emptyWrap: { flex: 1 },
  emptyCta: { paddingBottom: space.x4 },
  listContent: { paddingBottom: space.x4 },
  headerButton: {
    width: control.minTouch,
    height: control.minTouch,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -space.x2,
  },
  pressed: { opacity: 0.55 },
  searchBar: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.fieldBg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.x2,
    paddingHorizontal: space.x3,
    marginBottom: space.x2,
  },
  searchInput: {
    ...type.body,
    flex: 1,
    minWidth: 0,
    color: dark.text,
    paddingVertical: space.x2,
  },
  clearButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: dark.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    paddingVertical: space.x3,
  },
  rowPressed: {
    backgroundColor: dark.fieldBg,
    marginHorizontal: -space.x2,
    paddingHorizontal: space.x2,
    borderRadius: 12,
  },
  rowContent: { flex: 1, minWidth: 0, gap: 4 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  name: {
    ...type.body,
    flex: 1,
    minWidth: 0,
    color: dark.text,
    fontFamily: fonts.bodySemibold,
    letterSpacing: -0.2,
  },
  time: { ...type.caption, fontSize: 12, color: dark.textMuted },
  rowBottom: { minHeight: 22, flexDirection: "row", alignItems: "center", gap: space.x2 },
  preview: { ...type.caption, flex: 1, minWidth: 0, color: dark.textMuted },
  previewUnread: { color: dark.text },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: dark.line, marginLeft: 64 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.accentStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: colors.onAccent,
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    lineHeight: 13,
  },
  noResults: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: space.x10 },
  noResultsIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: dark.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.x4,
  },
  noResultsTitle: { ...type.heading, color: dark.text },
  noResultsBody: { ...type.caption, color: dark.textMuted, marginTop: space.x1 },
});
