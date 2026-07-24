import { colors, fonts, space, type } from "../../../src/lib/theme";
import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ArrowRight, Bell, Heart, Sparkles, Video } from "lucide-react-native";
import { getMyProfile, getReceivedProposals, getUnreadCount } from "@mingle/client-core";
import { DoodleCard } from "../../../src/components/Doodle";
import { AppScreen } from "../../../src/components/AppScreen";
import { ListRow, RowSeparator } from "../../../src/components/ListRow";
import { Enter } from "../../../src/components/Motion";
import { FEATURES } from "../../../src/lib/features";

export default function Home() {
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
    <AppScreen tabScreen contentStyle={styles.content}>
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
            <ArrowRight color={colors.accent} size={22} strokeWidth={2.2} />
          </DoodleCard>
        </Pressable>
      </Enter>

      <Enter index={2}>
        <Text style={styles.sectionLabel}>최근</Text>
        <DoodleCard contentStyle={styles.hub}>
          <ListRow
            gutter={0}
            leading={<Heart color={colors.ink} size={20} strokeWidth={1.75} />}
            title="프로포즈"
            trailing={pending > 0 ? <CountPill n={pending} /> : undefined}
            onPress={() => router.push("/proposals")}
          />
          <RowSeparator gutter={0} />
          <ListRow
            gutter={0}
            leading={<Bell color={colors.ink} size={20} strokeWidth={1.75} />}
            title="알림"
            trailing={unread > 0 ? <CountPill n={unread} /> : undefined}
            onPress={() => router.push("/notifications")}
          />
          <RowSeparator gutter={0} />
          <ListRow
            gutter={0}
            leading={<Sparkles color={colors.grayMid} size={20} strokeWidth={1.75} />}
            title="게임 파티"
            subtitle={FEATURES.partyGame ? undefined : "준비 중"}
            trailing={FEATURES.partyGame ? undefined : <View />}
            onPress={FEATURES.partyGame ? onStartMatching : undefined}
          />
        </DoodleCard>
      </Enter>
    </AppScreen>
  );
}

function CountPill({ n }: { n: number }) {
  return (
    <View style={styles.countPill}>
      <Text style={styles.countText}>{n}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.x4, gap: space.x5 },
  header: {},
  hello: { ...type.caption, color: colors.grayMid },
  name: { ...type.title, color: colors.ink, marginTop: 2 },
  feature: { flexDirection: "row", alignItems: "center", gap: space.x4, paddingVertical: space.x2 },
  featureBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { ...type.heading, color: colors.ink },
  featureMeta: { ...type.caption, color: colors.grayMid },
  sectionLabel: { ...type.label, color: colors.grayMid, marginBottom: space.x3, marginLeft: space.x1 },
  hub: { paddingVertical: space.x1, paddingHorizontal: space.x4 },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.accentStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { ...type.caption, color: colors.onAccent, fontFamily: fonts.bodySemibold },
});
