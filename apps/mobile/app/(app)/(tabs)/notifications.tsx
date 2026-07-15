import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Platform,
  Pressable,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  setPushEnabled,
  type AppNotification,
} from "@mingle/client-core";
import {
  routeForNotification,
  type NotificationData,
} from "../../../src/lib/route-for-notification";
import { DashedLine, DoodleFace } from "../../../src/components/DoodleSvg";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { colors, fonts } from "../../../src/lib/theme";

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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  if (phase === "error")
    return (
      <View style={styles.center}>
        <Text style={styles.err}>알림을 불러오지 못했어요.</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>알림</Text>
        <View style={styles.toggle}>
          <Text style={styles.toggleLabel}>푸시</Text>
          <Switch
            value={pushOn}
            onValueChange={onTogglePush}
            trackColor={{ false: colors.grayLight, true: colors.accent }}
            thumbColor={colors.paper}
            ios_backgroundColor={colors.grayLight}
            // RN Web은 trackColor 객체를 무시하고 자체 기본 그린을 쓴다 — 웹 전용 prop으로 교정.
            {...(Platform.OS === "web"
              ? ({ activeTrackColor: colors.accent, activeThumbColor: colors.paper } as object)
              : {})}
          />
        </View>
      </View>
      <Pressable onPress={onMarkAll}>
        <Text style={styles.markAll}>모두 읽음</Text>
      </Pressable>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingBottom: clearance }}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <View style={styles.center}>
            <DoodleFace variant="flat" size={64} />
            <Text style={styles.empty}>아직 알림이 없어요.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onTapItem(item)}>
            <View style={styles.rowHead}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              {!item.read ? <View style={styles.dot} /> : null}
            </View>
            <Text style={styles.rowMsg}>{item.message}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.paper },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleLabel: { color: colors.ink, fontSize: 14 },
  markAll: { color: colors.grayMid, fontSize: 13, marginBottom: 8 },
  // Old separator was full-bleed inside the padded container — the wrap keeps that (100% width
  // also gives the DashedLine Svg's percentage width a definite parent).
  separatorWrap: { width: "100%" },
  row: { paddingVertical: 12 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  rowTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  rowMsg: { fontSize: 12.5, color: colors.grayMid, marginTop: 2 },
  empty: { textAlign: "center", color: colors.grayMid, marginTop: 40 },
  err: { color: colors.ink },
});
