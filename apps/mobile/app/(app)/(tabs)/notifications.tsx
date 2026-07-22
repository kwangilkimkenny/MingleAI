import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Platform,
  Pressable,
  Switch,
  StyleSheet,
} from "react-native";
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
import { DashedLine } from "../../../src/components/DoodleSvg";
import { EnterRow } from "../../../src/components/Motion";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { colors, control, layout, space, type } from "../../../src/lib/theme";
import { ContentColumn, PageHeader, StateView } from "../../../src/components/Foundation";

const Separator = () => (
  <View style={styles.separatorWrap}>
    <DashedLine />
  </View>
);

export default function Notifications() {
  const clearance = useTabBarClearance();
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
    return <StateView title="알림을 불러오고 있어요" loading />;
  if (phase === "error")
    return <StateView title="알림을 불러오지 못했어요" actionLabel="다시 시도" onAction={load} />;

  return (
    <View style={styles.container}>
      <ContentColumn style={styles.headerColumn}>
        <PageHeader title="알림" description="프로포즈와 새로운 대화 소식을 한곳에서 확인해요." />
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceText}>
            <Text style={styles.preferenceTitle}>푸시 알림</Text>
            <Text style={styles.toggleLabel}>새로운 소식을 기기에서 받아요.</Text>
          </View>
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
        </View>
        <Pressable
          onPress={onMarkAll}
          accessibilityRole="button"
          accessibilityLabel="모든 알림 읽음 처리"
          disabled={items.length === 0 || items.every((item) => item.read)}
          style={({ pressed }) => [styles.markAllButton, pressed && styles.pressed]}
        >
          <Text style={styles.markAll}>모두 읽음으로 표시</Text>
        </Pressable>
      </ContentColumn>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <StateView title="아직 알림이 없어요" body="새로운 프로포즈나 대화 소식이 오면 여기에 알려드릴게요." />
        }
        renderItem={({ item, index }) => (
          <EnterRow index={index}>
            <Pressable
              style={({ pressed }) => [styles.row, !item.read && styles.rowUnread, pressed && styles.pressed]}
              onPress={() => onTapItem(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.read ? "" : "읽지 않음, "}${item.title}. ${item.message}`}
            >
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                {!item.read ? (
                  <View style={styles.unreadBadge}>
                    <View style={styles.dot} />
                    <Text style={styles.unreadText}>새 알림</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.rowMsg}>{item.message}</Text>
            </Pressable>
          </EnterRow>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  headerColumn: { paddingHorizontal: layout.screenGutter },
  preferenceRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
    paddingVertical: space.x2,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  preferenceText: { flex: 1 },
  preferenceTitle: { ...type.label, color: colors.ink },
  toggleLabel: { ...type.caption, color: colors.grayDark },
  markAllButton: {
    minHeight: control.minTouch,
    alignSelf: "flex-end",
    justifyContent: "center",
    paddingHorizontal: space.x2,
    marginBottom: space.x1,
  },
  markAll: { ...type.label, color: colors.ink },
  list: { width: "100%", maxWidth: layout.contentMax, alignSelf: "center" },
  // Old separator was full-bleed inside the padded container — the wrap keeps that (100% width
  // also gives the DashedLine Svg's percentage width a definite parent).
  separatorWrap: { width: "100%" },
  row: {
    minHeight: 76,
    paddingVertical: space.x3,
    paddingHorizontal: layout.screenGutter,
    justifyContent: "center",
  },
  rowUnread: { backgroundColor: colors.fill },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  unreadBadge: { flexDirection: "row", alignItems: "center", gap: space.x1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  unreadText: { ...type.caption, color: colors.accentDeep },
  rowTitle: { ...type.heading, fontSize: 18, lineHeight: 23, color: colors.ink, flex: 1 },
  rowMsg: { ...type.caption, color: colors.grayDark, marginTop: space.x1 },
  pressed: { opacity: 0.68 },
});
