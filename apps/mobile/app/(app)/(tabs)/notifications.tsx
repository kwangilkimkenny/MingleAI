import { useCallback, useState } from "react";
import { View, Text, FlatList, Platform, Pressable, Switch, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  getNotifications,
  getPushEnabled,
  markNotificationRead,
  markAllNotificationsRead,
  setPushEnabled,
  type AppNotification,
} from "@mingle/client-core";
import {
  routeForNotification,
  type NotificationData,
} from "../../../src/lib/route-for-notification";
import { EnterRow } from "../../../src/components/Motion";
import { AppScreen } from "../../../src/components/AppScreen";
import { ListRow, RowSeparator } from "../../../src/components/ListRow";
import { StateView } from "../../../src/components/Foundation";
import { colors, space, type } from "../../../src/lib/theme";

const ListSep = () => <RowSeparator gutter={0} />;

export default function Notifications() {
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

  useFocusEffect(load);

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
  }

  function onMarkAll() {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    markAllNotificationsRead().catch(() => {});
  }

  async function onTogglePush(v: boolean) {
    setPushOn(v);
    setPushEnabled(v).catch(() => setPushOn(!v));
  }

  if (phase === "loading")
    return (
      <AppScreen tabScreen header={{ back: true, title: "알림" }} body="plain">
        <StateView title="알림을 불러오고 있어요" loading />
      </AppScreen>
    );
  if (phase === "error")
    return (
      <AppScreen tabScreen header={{ back: true, title: "알림" }} body="plain">
        <StateView title="알림을 불러오지 못했어요" actionLabel="다시 시도" onAction={load} />
      </AppScreen>
    );

  const allRead = items.length === 0 || items.every((x) => x.read);

  return (
    <AppScreen
      tabScreen
      header={{
        back: true,
        title: "알림",
        action: (
          <Pressable
            onPress={onMarkAll}
            disabled={allRead}
            accessibilityRole="button"
            accessibilityLabel="모든 알림 읽음 처리"
            hitSlop={8}
            style={({ pressed }) => (pressed && !allRead ? styles.pressed : undefined)}
          >
            <Text style={[styles.markAll, allRead && styles.markAllOff]}>모두 읽음</Text>
          </Pressable>
        ),
      }}
      body="plain"
    >
      {/* 푸시 알림 토글 — 리스트 위 고정 설정 행. */}
      <ListRow
        title="푸시 알림"
        gutter={space.x2}
        trailing={
          <Switch
            value={pushOn}
            onValueChange={onTogglePush}
            accessibilityLabel="푸시 알림"
            accessibilityState={{ checked: pushOn }}
            trackColor={{ false: colors.grayLight, true: colors.accent }}
            thumbColor={colors.paper}
            ios_backgroundColor={colors.grayLight}
            // RN Web은 trackColor 객체를 무시하고 자체 기본 그린을 쓴다 — 웹 전용 prop으로 교정.
            {...(Platform.OS === "web"
              ? ({ activeTrackColor: colors.accent, activeThumbColor: colors.paper } as object)
              : {})}
          />
        }
      />
      <RowSeparator gutter={0} />
      <FlatList
        style={styles.flex}
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={ListSep}
        ListEmptyComponent={
          <StateView
            title="아직 알림이 없어요"
            body="새로운 프로포즈나 대화 소식이 오면 여기에 알려드릴게요."
          />
        }
        renderItem={({ item, index }) => (
          <EnterRow index={index}>
            <View style={!item.read ? styles.unreadRow : undefined}>
              <ListRow
                title={item.title}
                subtitle={item.message}
                gutter={space.x2}
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
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { flexGrow: 1 },
  markAll: { ...type.label, color: colors.ink },
  markAllOff: { color: colors.grayMid },
  pressed: { opacity: 0.6 },
  // 안읽음 행은 연회색 fill로 은은히 강조 — 읽음/안읽음 구분 유지.
  unreadRow: { backgroundColor: colors.fill },
  // 트레일링 슬롯 폭을 고정해 읽음/안읽음 행의 제목 정렬을 맞춘다(읽음=빈 슬롯).
  dotSlot: { width: 10, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
