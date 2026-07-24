/**
 * NotificationsPopup — 운영팀(어드민) 공지 피드. 홈 우상단 벨 아이콘에서 여는 투명 다크 바텀
 * 시트 팝업. 공지 리스트(읽음 처리)·빈/로딩/에러만 — 타이틀·mark-all·푸시 토글·핸들바는 없다
 * (프로포즈/대화 알림 용도가 아님). 탭하면 해당 딥링크로 이동 후 닫힌다.
 */
import { useCallback, useEffect, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, Modal } from "react-native";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getNotifications, markNotificationRead, type AppNotification } from "@mingle/client-core";
import { routeForNotification, type NotificationData } from "../lib/route-for-notification";
import { EnterRow } from "./Motion";
import { ListRow, RowSeparator } from "./ListRow";
import { StateView } from "./Foundation";
import { dark, space } from "../lib/theme";

const ListSep = () => <RowSeparator gutter={0} dark />;

/** 최소 슬롯 수 — 공지가 없어도 빈 칸이 구분선으로 나뉜 리스트 UI가 보이도록. */
const MIN_SLOTS = 8;
/** 클라 기본 환영 공지의 고정 id. */
const WELCOME_ID = "__welcome__";

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
  // 기본 환영 공지 — 백엔드 행이 아니라 클라 기본 항목. 읽음 상태만 로컬로 추적.
  const [welcomeRead, setWelcomeRead] = useState(false);

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
    if (n.id === WELCOME_ID) {
      setWelcomeRead(true);
      return;
    }
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

  // 기본 환영 공지(맨 아래) + 실제 공지(위) + 빈 슬롯 패딩. 구분선으로 나뉜 리스트에 위부터 찬다.
  const welcome: AppNotification = {
    id: WELCOME_ID,
    type: "system",
    title: "가입을 축하드립니다",
    message: "밍글에 오신 걸 환영해요. 로테이션 블라인드 소개팅으로 인연을 만나보세요.",
    data: null,
    read: welcomeRead,
    createdAt: "",
  };
  const feed = [...items, welcome];
  const rows: (AppNotification | null)[] = [
    ...feed,
    ...Array(Math.max(0, MIN_SLOTS - feed.length)).fill(null),
  ];

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
              {/* 고정 슬롯 리스트 — 빈 칸이 구분선으로 나뉘어 보이고, 공지가 오면 위부터 하나씩 찬다. */}
              <FlatList
                style={styles.list}
                data={rows}
                keyExtractor={(n, i) => n?.id ?? `slot-${i}`}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={ListSep}
                renderItem={({ item, index }) =>
                  item ? (
                    <EnterRow index={index}>
                      <View style={item.read ? styles.readRow : styles.unreadRow}>
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
                  ) : (
                    <View style={styles.emptySlot} />
                  )
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: space.x5,
    paddingTop: space.x3,
    paddingBottom: space.x2,
  },
  pressed: { opacity: 0.6 },
  // 컨텐츠 영역이 패널 maxHeight 안에서 줄어들 수 있어야 FlatList가 스크롤된다.
  content: { flexShrink: 1, minHeight: 0 },
  list: { flexShrink: 1 },
  listContent: { flexGrow: 1 },
  // 빈 슬롯 — 공지가 아직 없는 칸. 알림 행과 같은 높이로 두어 리스트 구조가 보인다.
  emptySlot: { minHeight: 62 },
  // 안읽음 = 밝게(풀 크림 + 살짝 밝은 서피스로 강조). 읽음 = 진하게(딤 처리로 배경에 가라앉음).
  unreadRow: { backgroundColor: dark.surfaceHi },
  readRow: { opacity: 0.45 },
  // 트레일링 슬롯 폭을 고정해 읽음/안읽음 행의 제목 정렬을 맞춘다(읽음=빈 슬롯).
  dotSlot: { width: 10, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: dark.accent },
  stateWrap: { paddingVertical: space.x8, paddingHorizontal: space.x5 },
});
