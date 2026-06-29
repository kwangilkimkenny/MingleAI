import { View, Text, Button, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "../../src/lib/client";

export default function Home() {
  const logout = useAuthStore((s) => s.logout);

  function onLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>로그인 성공 🎉</Text>
      <Text style={styles.subtitle}>토큰이 안전하게 저장되었습니다.</Text>
      <Button title="로그아웃" onPress={onLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: "600" },
  subtitle: { color: "#666" },
});
