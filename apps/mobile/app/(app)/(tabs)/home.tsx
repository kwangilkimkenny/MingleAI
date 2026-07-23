import { colors, fonts, layout, space, type } from "../../../src/lib/theme";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ArrowRight, Bell, ChevronRight, Heart, Sparkles, Video } from "lucide-react-native";
import { getMyProfile, getReceivedProposals, getUnreadCount } from "@mingle/client-core";
import { DoodleCard } from "../../../src/components/Doodle";
import { DashedLine } from "../../../src/components/DoodleSvg";
import { Enter } from "../../../src/components/Motion";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { ContentColumn } from "../../../src/components/Foundation";
import { FEATURES } from "../../../src/lib/features";

export default function Home() {
  const clearance = useTabBarClearance();
  const [name, setName] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [unread, setUnread] = useState(0);
  const navigatingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      navigatingRef.current = false;
      let alive = true;
      void getMyProfile()
        .then((p) => {
          if (alive && p) setName(p.name);
        })
        .catch(() => {});
      void getReceivedProposals()
        .then((list) => {
          if (alive) setPending(list.filter((p) => p.status === "pending").length);
        })
        .catch(() => {});
      void getUnreadCount()
        .then(({ unreadCount }) => {
          if (alive) setUnread(unreadCount);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  function onStartMatching() {
    if (!FEATURES.partyGame || navigatingRef.current) return;
    navigatingRef.current = true;
    router.push("/(app)/matching");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
    >
      <ContentColumn style={styles.column}>
        <Enter index={0}>
          <View style={styles.header}>
            <Text style={styles.hello}>안녕하세요</Text>
            <Text style={styles.name}>{name ?? "환영해요"}</Text>
          </View>
        </Enter>

        <Enter index={1}>
          <Pressable
            onPress={() => router.push("/(app)/speed-date")}
            accessibilityRole="button"
            accessibilityLabel="블라인드 데이트 시작"
            style={({ pressed }) => pressed && { opacity: 0.9 }}
          >
            <DoodleCard elevated contentStyle={styles.feature}>
              <View style={styles.featureBadge}>
                <Video color={colors.onAccent} size={22} strokeWidth={2.2} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>블라인드 데이트</Text>
                <Text style={styles.featureMeta}>3분 · 1:1 · 목소리 → 얼굴</Text>
              </View>
              <ArrowRight color={colors.accent} size={22} strokeWidth={2.4} />
            </DoodleCard>
          </Pressable>
        </Enter>

        <Enter index={2}>
          <Text style={styles.sectionLabel}>최근</Text>
          <DoodleCard contentStyle={styles.hub}>
            <HubRow
              icon={<Heart color={colors.ink} size={20} strokeWidth={2} />}
              label="프로포즈"
              count={pending}
              onPress={() => router.push("/proposals")}
            />
            <DashedLine />
            <HubRow
              icon={<Bell color={colors.ink} size={20} strokeWidth={2} />}
              label="알림"
              count={unread}
              onPress={() => router.push("/notifications")}
            />
            <DashedLine />
            <HubRow
              icon={<Sparkles color={colors.grayMid} size={20} strokeWidth={2} />}
              label="게임 파티"
              note={FEATURES.partyGame ? undefined : "준비 중"}
              disabled={!FEATURES.partyGame}
              onPress={onStartMatching}
            />
          </DoodleCard>
        </Enter>
      </ContentColumn>
    </ScrollView>
  );
}

function HubRow({
  icon,
  label,
  count = 0,
  note,
  disabled = false,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  note?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${label} ${count}건` : label}
      style={({ pressed }) => [styles.hubRow, pressed && !disabled && { opacity: 0.7 }]}
    >
      <View style={[styles.hubIcon, disabled && styles.hubIconOff]}>{icon}</View>
      <Text style={[styles.hubLabel, disabled && styles.hubLabelOff]}>{label}</Text>
      {count > 0 ? (
        <View style={styles.countPill}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
      {note ? <Text style={styles.hubNote}>{note}</Text> : null}
      {!disabled ? <ChevronRight color={colors.grayMid} size={20} strokeWidth={2} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: layout.screenGutter },
  column: { gap: space.x5, paddingTop: space.x4 },
  header: {},
  hello: { ...type.caption, color: colors.grayMid },
  name: { ...type.title, color: colors.ink, marginTop: 2 },
  feature: { flexDirection: "row", alignItems: "center", gap: space.x4, paddingVertical: space.x2 },
  featureBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { ...type.heading, color: colors.ink },
  featureMeta: { ...type.caption, color: colors.grayMid },
  sectionLabel: { ...type.label, color: colors.grayMid, marginBottom: space.x3, marginLeft: space.x1 },
  hub: { paddingVertical: space.x1 },
  hubRow: { flexDirection: "row", alignItems: "center", gap: space.x3, minHeight: 52 },
  hubIcon: { width: 24, alignItems: "center" },
  hubIconOff: { opacity: 0.6 },
  hubLabel: { ...type.body, color: colors.ink, flex: 1 },
  hubLabelOff: { color: colors.grayMid },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { ...type.caption, color: colors.onAccent, fontFamily: fonts.bodySemibold },
  hubNote: { ...type.caption, color: colors.grayMid },
});
