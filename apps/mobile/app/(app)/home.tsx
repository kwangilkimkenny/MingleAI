import { useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../src/lib/client";

export default function Home() {
  const logout = useAuthStore((s) => s.logout);
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [showNotice, setShowNotice] = useState(true);

  function onLogout() {
    logout();
  }

  return (
    <View style={styles.container}>
      {notice && showNotice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
          <Text style={styles.noticeDismiss} onPress={() => setShowNotice(false)}>✕</Text>
        </View>
      ) : null}
      <Text style={styles.title}>MingleAI</Text>
      <Text style={styles.subtitle}>가벼운 만남, 편안한 연결</Text>
      <Button title="로그아웃" onPress={onLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: "600" },
  subtitle: { color: "#666" },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 8,
    backgroundColor: "#f8f8f8",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  noticeText: { flex: 1, fontSize: 13, color: "#555" },
  noticeDismiss: { fontSize: 14, color: "#999", paddingHorizontal: 4 },
});
