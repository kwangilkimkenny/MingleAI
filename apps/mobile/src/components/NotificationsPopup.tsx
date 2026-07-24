/**
 * NotificationsPopup — 알림 페이지((app)/(tabs)/notifications.tsx)의 데이터·로직을 그대로
 * 옮긴 투명 다크 바텀 시트 팝업. 홈 우상단 벨 아이콘에서 연다(배선은 홈 화면 소유).
 * 페이지와 동일하게 알림 리스트·읽음/mark-all·푸시 토글 Switch·빈/로딩/에러 상태를 다룬다.
 * 다크 톤(dark 토큰)·명조 헤더(serifFont)로 홈 테마와 결을 맞춘다.
 */
import { useCallback, useEffect, useState } from "react";
import { View, FlatList, Platform, Pressable, Switch, StyleSheet, Modal } from "react-native";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getNotifications,
  getPushEnabled,
  markNotificationRead,
  setPushEnabled,
  type AppNotification,
} from "@mingle/client-core";
import { routeForNotification, type NotificationData } from "../lib/route-for-notification";
import { EnterRow } from "./Motion";
import { ListRow, RowSeparator } from "./ListRow";
import { StateView } from "./Foundation";
import { dark, space } from "../lib/theme";

const ListSep = () => <RowSeparator gutter={0} dark />;

export function NotificationsPopup({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [pushOn, setPushOn] = useState(true);

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    Promise.all([getNotifications(50, 0), getPushEnabled()])
      .then(([res, push]) => {
        if (alive) {
          setItems(res.notifications);
          setPushOn(push.pushEnabled);
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
      markNotificationRead(n.id).catch(() => {});
    }
    router.push(
      routeForNotification({
        type: n.type,
        ...((n.data as object) ?? {}),
      } as NotificationData),
    );
    onClose();
  }

  async function onTogglePush(v: boolean) {
    setPushOn(v);
    setPushEnabled(v).catch(() => setPushOn(!v));
  }

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
          <View style={styles.handle} />
          <View style={styles.header}>
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
              {/* 푸시 알림 토글 — 리스트 위 고정 설정 행. */}
              <ListRow
                title="푸시 알림"
                dark
                gutter={space.x5}
                trailing={
                  <Switch
                    value={pushOn}
                    onValueChange={onTogglePush}
                    accessibilityLabel="푸시 알림"
                    accessibilityState={{ checked: pushOn }}
                    trackColor={{ false: dark.line, true: dark.accent }}
                    thumbColor={dark.text}
                    ios_backgroundColor={dark.line}
                    // RN Web은 trackColor 객체를 무시하고 자체 기본 그린을 쓴다 — 웹 전용 prop으로 교정.
                    {...(Platform.OS === "web"
                      ? ({ activeTrackColor: dark.accent, activeThumbColor: dark.text } as object)
                      : {})}
                  />
                }
              />
              <RowSeparator gutter={0} dark />
              <FlatList
                style={styles.list}
                data={items}
                keyExtractor={(n) => n.id}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={ListSep}
                ListEmptyComponent={
                  <StateView
                    dark
                    title="아직 알림이 없어요"
                    body="새로운 프로포즈나 대화 소식이 오면 여기에 알려드릴게요."
                  />
                }
                renderItem={({ item, index }) => (
                  <EnterRow index={index}>
                    <View style={!item.read ? styles.unreadRow : undefined}>
                      <ListRow
                        dark
                        title={item.title}
                        subtitle={item.message}
                        gutter={space.x5}
                        onPress={() => onTapItem(item)}
                        accessibilityLabel={`${item.read ? "" : "읽지 않음, "}${item.title}. ${item.message}`}
                        trailing={
                          <View style={styles.dotSlot}>
                            {!item.read ? <View style={styles.dot} /> : null}
                          </View>
                        }
                      />
                    </View>
                  </EnterRow>
                )}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10,7,5,0.55)" },
  panel: {
    maxHeight: "80%",
    // 반투명 다크 서피스 — 백드롭 위로 은은히 비친다.
    backgroundColor: "rgba(26,20,15,0.94)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: dark.border,
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: dark.border,
    alignSelf: "center",
    marginTop: space.x2,
    marginBottom: space.x1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: space.x5,
    paddingVertical: space.x2,
  },
  pressed: { opacity: 0.6 },
  // 컨텐츠 영역이 패널 maxHeight 안에서 줄어들 수 있어야 FlatList가 스크롤된다.
  content: { flexShrink: 1, minHeight: 0 },
  list: { flexShrink: 1 },
  listContent: { flexGrow: 1 },
  // 안읽음 행은 살짝 밝은 다크 서피스로 은은히 강조 — 읽음/안읽음 구분 유지.
  unreadRow: { backgroundColor: dark.surfaceHi },
  // 트레일링 슬롯 폭을 고정해 읽음/안읽음 행의 제목 정렬을 맞춘다(읽음=빈 슬롯).
  dotSlot: { width: 10, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: dark.accent },
  stateWrap: { paddingVertical: space.x8, paddingHorizontal: space.x5 },
});
