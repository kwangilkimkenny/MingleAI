/**
 * NotificationsPopup — 운영팀(어드민) 공지 피드. 홈 우상단 벨 아이콘에서 여는 투명 다크 바텀
 * 시트 팝업. 공지 리스트(읽음 처리)·빈/로딩/에러만 — 타이틀·mark-all·푸시 토글·핸들바는 없다
 * (대화 알림 용도가 아님). 탭하면 해당 딥링크로 이동 후 닫힌다.
 */
import { useCallback, useEffect, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, Modal, Text } from "react-native";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@mingle/client-core";
import { EnterRow } from "./Motion";
import { ListRow, RowSeparator } from "./ListRow";
import { StateView } from "./Foundation";
import { notificationRowAppearance } from "../lib/notification-appearance";
import { dark, space, type } from "../lib/theme";

const ListSep = () => <RowSeparator gutter={0} dark />;

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}시간 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function NotificationsPopup({
  visible,
  onClose,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  /** 읽음 처리로 안읽음 수가 바뀐 직후 — 홈 벨 배지를 즉시 다시 세게 한다. */
  onChanged?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    getNotifications(50, 0)
      .then((res) => {
        if (alive) {
          setItems(res.notifications);
          setPhase("ready");
        }
      })
      .catch((_e) => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  // 팝업이 열릴 때마다 로드(페이지의 useFocusEffect 대체).
  useEffect(() => {
    if (!visible) return;
    return load();
  }, [visible, load]);

  function onTapItem(n: AppNotification) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      markNotificationRead(n.id)
        .then(() => onChanged?.())
        .catch(() => {});
    }
    onClose();
    // 공지 상세(전체화면)로. 제목·본문을 파라미터로 넘긴다.
    router.push({
      // new route — Expo Router typegen updates on next `expo start`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pathname: "/(app)/announcement" as any,
      params: { title: n.title, message: n.message, createdAt: n.createdAt },
    });
  }

  async function onReadAll() {
    if (!items.some((item) => !item.read)) return;
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    try {
      await markAllNotificationsRead();
      onChanged?.();
    } catch {
      load();
    }
  }

  // 서버가 준 공지만 목록에 올린다. 클라가 만든 "환영해요" 항목을 섞으면 운영 공지처럼
  // 보이는데 실제로는 아무도 보낸 적이 없다(가짜 정보 감사 2026-08-07).
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="알림 닫기" />
        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, space.x4) }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={styles.title}>알림</Text>
              <Text style={styles.count}>{items.filter((item) => !item.read).length}개 읽지 않음</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="알림 모두 읽음"
              disabled={!items.some((item) => !item.read)}
              onPress={() => void onReadAll()}
              style={({ pressed }) => [styles.readAll, pressed && styles.pressed]}
            >
              <Text style={styles.readAllText}>모두 읽음</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="닫기"
              hitSlop={8}
              style={({ pressed }) => (pressed ? styles.pressed : undefined)}
            >
              <X color={dark.text} size={22} strokeWidth={1.75} />
            </Pressable>
          </View>

          {phase === "loading" ? (
            <View style={styles.stateWrap}>
              <StateView title="알림을 불러오고 있어요" loading dark />
            </View>
          ) : phase === "error" ? (
            <View style={styles.stateWrap}>
              <StateView
                title="알림을 불러오지 못했어요"
                dark
                actionLabel="다시 시도"
                onAction={load}
              />
            </View>
          ) : (
            <View style={styles.content}>
              {items.length === 0 ? (
                <View style={styles.stateWrap}>
                  <StateView title="아직 도착한 알림이 없어요" dark />
                </View>
              ) : null}
              <FlatList
                style={styles.list}
                data={items}
                keyExtractor={(n) => n.id}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={ListSep}
                renderItem={({ item, index }) =>
                    <EnterRow index={index}>
                      <View style={notificationRowAppearance(item.read)}>
                        <ListRow
                          dark
                          title={item.title}
                          subtitle={`${formatTime(item.createdAt)} · ${item.message}`}
                          gutter={space.x5}
                          onPress={() => onTapItem(item)}
                          accessibilityLabel={`${item.read ? "" : "읽지 않음, "}${item.title}. ${item.message}`}
                          trailing={
                            <View style={styles.dotSlot}>
                              {!item.read ? <Text style={styles.newLabel}>새 알림</Text> : null}
                            </View>
                          }
                        />
                      </View>
                    </EnterRow>
                }
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: dark.scrim },
  panel: {
    // 고정 % 높이 — auto+maxHeight 조합은 빈/로딩 상태 콘텐츠를 화면 밖으로 밀어냈다(QA 2026-07-27).
    minHeight: 280,
    maxHeight: "72%",
    backgroundColor: dark.surfaceTop,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: dark.border,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.x5,
    paddingTop: space.x3,
    paddingBottom: space.x2,
  },
  headerCopy: { flex: 1 },
  title: { ...type.title, color: dark.text },
  count: { ...type.caption, color: dark.textMuted, marginTop: 1 },
  readAll: { minHeight: 44, paddingHorizontal: space.x2, alignItems: "center", justifyContent: "center" },
  readAllText: { ...type.label, color: dark.accent },
  pressed: { opacity: 0.6 },
  // 컨텐츠 영역이 패널 maxHeight 안에서 줄어들 수 있어야 FlatList가 스크롤된다.
  content: { flexShrink: 1, minHeight: 0 },
  list: { flexShrink: 1 },
  listContent: { flexGrow: 1 },
  // 빈 슬롯 — 공지가 아직 없는 칸. 알림 행과 같은 높이로 두어 리스트 구조가 보인다.
  // 트레일링 슬롯 폭을 고정해 읽음/안읽음 행의 제목 정렬을 맞춘다(읽음=빈 슬롯).
  dotSlot: { minWidth: 46, alignItems: "flex-end", justifyContent: "center" },
  newLabel: { ...type.caption, fontSize: 10, color: dark.accent },
  stateWrap: { paddingVertical: space.x8, paddingHorizontal: space.x5 },
});
