import { colors } from "../../src/lib/theme";
import { useCallback, useRef, useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

export default function Home() {
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [showNotice, setShowNotice] = useState(true);
  const navigatingRef = useRef(false);

  // Reset guard when home regains focus, so a normal second visit still works.
  useFocusEffect(useCallback(() => { navigatingRef.current = false; }, []));

  function onStartMatching() {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    router.push("/(app)/matching");
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
      <Button title="매칭 시작" onPress={onStartMatching} />
      <Button title="프로포즈" onPress={() => router.push("/(app)/proposals")} />
      <Button title="채팅" onPress={() => router.push("/(app)/chats")} />
      <Button title="알림" onPress={() => router.push("/(app)/notifications")} />
      <Button
        title="설정"
        onPress={() =>
          // new route — Expo Router typegen updates on next `expo start`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push("/(app)/settings" as any)
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: "600" },
  subtitle: { color: colors.grayMid },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.grayLight,
    borderRadius: 8,
    backgroundColor: colors.fill,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  noticeText: { flex: 1, fontSize: 13, color: colors.grayDark },
  noticeDismiss: { fontSize: 14, color: colors.grayMid, paddingHorizontal: 4 },
});
