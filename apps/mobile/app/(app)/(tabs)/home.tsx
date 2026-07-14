import { colors, fonts } from "../../../src/lib/theme";
import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Sparkles, Heart } from "lucide-react-native";
import { DoodleButton, DoodleCard } from "../../../src/components/Doodle";

export default function Home() {
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [showNotice, setShowNotice] = useState(true);
  const navigatingRef = useRef(false);

  // Reset guard when home regains focus, so a normal second visit still works.
  useFocusEffect(
    useCallback(() => {
      navigatingRef.current = false;
    }, []),
  );

  function onStartMatching() {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    router.push("/(app)/matching");
  }

  return (
    <View style={styles.container}>
      {notice && showNotice ? (
        <DoodleCard
          tone="fill"
          rotate="-1deg"
          style={styles.noticeCard}
          contentStyle={styles.noticeInner}
        >
          <Text style={styles.noticeText}>{notice}</Text>
          <Text style={styles.noticeDismiss} onPress={() => setShowNotice(false)}>
            ✕
          </Text>
        </DoodleCard>
      ) : null}

      <View style={styles.hero}>
        <View style={styles.mark}>
          <Sparkles color={colors.ink} size={40} strokeWidth={1.75} />
        </View>
        <Text style={styles.title}>MingleAI</Text>
        <Text style={styles.subtitle}>가벼운 만남, 편안한 연결</Text>
      </View>

      <View style={styles.actions}>
        <DoodleButton
          title="매칭 시작"
          onPress={onStartMatching}
          variant="primary"
          rotate="-0.8deg"
          icon={(color, size) => <Heart color={color} size={size} strokeWidth={2} />}
        />
        <Text style={styles.hint}>
          새로운 사람들과 가볍게 만나보세요.{"\n"}채팅·프로포즈·알림은 아래 탭에서 확인해요.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: 32,
    padding: 24,
    paddingBottom: 84, // clears the floating doodle tab bar
    backgroundColor: colors.paper,
  },
  hero: { alignItems: "center", gap: 10 },
  mark: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fill,
  },
  title: { fontFamily: fonts.display, fontSize: 46, color: colors.ink },
  subtitle: { fontSize: 15, color: colors.grayMid },
  actions: { gap: 16 },
  hint: { fontSize: 13, color: colors.grayMid, textAlign: "center", lineHeight: 20 },
  noticeCard: { marginBottom: 4 },
  noticeInner: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  noticeText: { flex: 1, fontSize: 13, color: colors.grayDark },
  noticeDismiss: { fontSize: 15, color: colors.ink, paddingHorizontal: 4, fontWeight: "700" },
});
