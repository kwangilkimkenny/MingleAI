import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
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
import { routeForNotification, type NotificationData } from "../../../src/lib/route-for-notification";

const INK = "#17150F";

export default function Notifications() {
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
        <ActivityIndicator size="large" color={INK} />
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
            trackColor={{ false: "#D9D5CC", true: "#17150F" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D9D5CC"
          />
        </View>
      </View>
      <Pressable onPress={onMarkAll}>
        <Text style={styles.markAll}>모두 읽음</Text>
      </Pressable>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={<Text style={styles.empty}>아직 알림이 없어요.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, !item.read && styles.unread]}
            onPress={() => onTapItem(item)}
          >
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowMsg}>{item.message}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#FFFFFF" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: "700", color: INK },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleLabel: { color: INK, fontSize: 14 },
  markAll: { color: "#8A857C", fontSize: 13, marginBottom: 8 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E7E4DC" },
  unread: { backgroundColor: "#F1EFE9" },
  rowTitle: { fontSize: 15, fontWeight: "600", color: INK },
  rowMsg: { fontSize: 13, color: "#45413A", marginTop: 2 },
  empty: { textAlign: "center", color: "#8A857C", marginTop: 40 },
  err: { color: INK },
});
