import { colors } from "../../src/lib/theme";
import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { DoodleButton, DoodleCard } from "../../src/components/Doodle";

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
        <DoodleCard tone="fill" rotate="-1deg" style={styles.noticeCard} contentStyle={styles.noticeInner}>
          <Text style={styles.noticeText}>{notice}</Text>
          <Text style={styles.noticeDismiss} onPress={() => setShowNotice(false)}>
            ✕
          </Text>
        </DoodleCard>
      ) : null}

      <View style={styles.hero}>
        <Text style={styles.title}>MingleAI</Text>
        <Text style={styles.subtitle}>가벼운 만남, 편안한 연결</Text>
      </View>

      <View style={styles.actions}>
        <DoodleButton title="매칭 시작" onPress={onStartMatching} variant="primary" rotate="-0.8deg" />
        <DoodleButton title="프로포즈" onPress={() => router.push("/(app)/proposals")} />
        <DoodleButton title="채팅" onPress={() => router.push("/(app)/chats")} />
        <DoodleButton title="알림" onPress={() => router.push("/(app)/notifications")} />
        <DoodleButton
          title="설정"
          onPress={() =>
            // new route — Expo Router typegen updates on next `expo start`
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.push("/(app)/settings" as any)
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: 28,
    padding: 24,
    backgroundColor: colors.paper,
  },
  hero: { alignItems: "center", gap: 6 },
  title: { fontSize: 40, fontWeight: "800", color: colors.ink, letterSpacing: 0.5 },
  subtitle: { fontSize: 15, color: colors.grayMid },
  actions: { gap: 14 },
  noticeCard: { marginBottom: 4 },
  noticeInner: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  noticeText: { flex: 1, fontSize: 13, color: colors.grayDark },
  noticeDismiss: { fontSize: 15, color: colors.ink, paddingHorizontal: 4, fontWeight: "700" },
});
