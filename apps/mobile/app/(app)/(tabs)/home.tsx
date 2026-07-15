import { colors, doodle, fonts } from "../../../src/lib/theme";
import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Heart, ChevronRight, Zap } from "lucide-react-native";
import { getMyProfile } from "@mingle/client-core";
import { DoodleButton, DoodleCard, ShadowBox } from "../../../src/components/Doodle";
import { Enter } from "../../../src/components/Motion";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";

export default function Home() {
  const clearance = useTabBarClearance();
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [showNotice, setShowNotice] = useState(true);
  const [name, setName] = useState<string | null>(null);
  const navigatingRef = useRef(false);

  // Reset the nav guard AND refetch the profile whenever home regains focus, so the
  // greeting name is fresh after e.g. returning from settings.
  useFocusEffect(
    useCallback(() => {
      navigatingRef.current = false;
      let alive = true;
      getMyProfile()
        .then((profile) => {
          if (alive && profile) setName(profile.name);
        })
        .catch(() => {
          // Ignore — the greeting simply falls back to the nameless form.
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  function onStartMatching() {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    router.push("/(app)/matching");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
    >
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

      <Enter index={0}>
        <View style={styles.appbar}>
          <Text style={styles.greetingTiny}>안녕하세요 👋</Text>
          <Text style={styles.greetingTitle}>
            {name ? `${name}님, 오늘 나가볼까요?` : "오늘 나가볼까요?"}
          </Text>
        </View>
      </Enter>

      <Enter index={1}>
        <ShadowBox
          radius={doodle.radius.card}
          bg={colors.ink}
          rotate="-0.6deg"
          style={styles.heroOuter}
        >
          <View style={styles.heroInner}>
            <View style={styles.heroTitleRow}>
              <Zap color={colors.accentSoft} size={20} strokeWidth={2.4} />
              <Text style={styles.heroTitle}>AI 매칭</Text>
            </View>
            <Text style={styles.heroDesc}>취향을 분석해 잘 맞는 사람들과 파티를 만들어줘요.</Text>
            <DoodleButton
              title="매칭 시작"
              onPress={onStartMatching}
              variant="primary"
              rotate="-0.8deg"
              icon={(color, size) => <Heart color={color} size={size} strokeWidth={2} />}
            />
          </View>
        </ShadowBox>
      </Enter>

      <View style={styles.shortcuts}>
        <Enter index={2}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/chats")}
            style={({ pressed }) => (pressed ? styles.shortcutPressed : null)}
          >
            <DoodleCard rotate="0.5deg">
              <View style={styles.shortcutRow}>
                <View style={styles.shortcutText}>
                  <Text style={styles.shortcutTitle}>💬 채팅</Text>
                  <Text style={styles.shortcutDesc}>매칭된 사람들과의 대화를 이어가요.</Text>
                </View>
                <ChevronRight color={colors.grayMid} size={22} strokeWidth={2} />
              </View>
            </DoodleCard>
          </Pressable>
        </Enter>

        <Enter index={3}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/proposals")}
            style={({ pressed }) => (pressed ? styles.shortcutPressed : null)}
          >
            <DoodleCard rotate="-0.4deg">
              <View style={styles.shortcutRow}>
                <View style={styles.shortcutText}>
                  <Text style={styles.shortcutTitle}>🤝 프로포즈</Text>
                  <Text style={styles.shortcutDesc}>마음에 든 사람에게 프로포즈를 보내요.</Text>
                </View>
                <ChevronRight color={colors.grayMid} size={22} strokeWidth={2} />
              </View>
            </DoodleCard>
          </Pressable>
        </Enter>
      </View>

      <Enter index={4}>
        <Text style={styles.hint}>
          새로운 사람들과 가볍게 만나보세요.{"\n"}채팅·프로포즈·알림은 아래 탭에서 확인해요.
        </Text>
      </Enter>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { gap: 20, padding: 20 },
  noticeCard: { marginBottom: 4 },
  noticeInner: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  noticeText: { flex: 1, fontSize: 13, color: colors.grayDark },
  noticeDismiss: { fontSize: 15, color: colors.ink, paddingHorizontal: 4, fontWeight: "700" },
  appbar: { gap: 2 },
  greetingTiny: { fontSize: 13, color: colors.grayMid },
  greetingTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  heroOuter: { alignSelf: "stretch" },
  heroInner: { padding: 18, gap: 12 },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.paper },
  heroDesc: { fontSize: 13.5, color: colors.paper, opacity: 0.85, lineHeight: 19 },
  shortcuts: { gap: 12 },
  shortcutPressed: { opacity: 0.85 },
  shortcutRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  shortcutText: { flex: 1, gap: 3 },
  shortcutTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  shortcutDesc: { fontSize: 12.5, color: colors.grayMid },
  hint: { fontSize: 13, color: colors.grayMid, textAlign: "center", lineHeight: 20 },
});
