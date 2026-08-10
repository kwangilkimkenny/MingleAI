import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  Bell,
  ChevronRight,
  MapPin,
  MessageCircle,
  Mic2,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react-native";
import {
  getMyProfile,
  getSpeedDateStatus,
  getUnreadCount,
  type SpeedDateStatus,
} from "@mingle/client-core";
import { DoodleButton } from "../../../src/components/Doodle";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { NotificationsPopup } from "../../../src/components/NotificationsPopup";
import { dark, layout, space, type } from "../../../src/lib/theme";
import { serifFont } from "../../../src/lib/serif";

/** Operational home: current matching state first, brand atmosphere second. */
export default function Home() {
  const insets = useSafeAreaInsets();
  const clearance = useTabBarClearance();
  const alive = useRef(true);
  const [name, setName] = useState("회원");
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState<SpeedDateStatus | null>(null);
  const [popup, setPopup] = useState(false);

  const refresh = useCallback(() => {
    alive.current = true;
    void Promise.allSettled([getMyProfile(), getUnreadCount(), getSpeedDateStatus()]).then(
      ([profile, notices, queue]) => {
        if (!alive.current) return;
        if (profile.status === "fulfilled" && profile.value?.name) setName(profile.value.name);
        if (notices.status === "fulfilled") setUnread(notices.value.unreadCount);
        if (queue.status === "fulfilled") setStatus(queue.value);
      },
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {
        alive.current = false;
      };
    }, [refresh]),
  );

  function openMatch() {
    if (status?.status === "matched" && status.sessionId) {
      router.push({ pathname: "/(app)/speed-date/[id]", params: { id: status.sessionId } });
      return;
    }
    router.push("/(app)/speed-date");
  }

  const actionLabel =
    status?.status === "matched"
      ? "진행 중인 데이트로 돌아가기"
      : status?.status === "waiting"
        ? "대기 현황 확인하기"
        : "블라인드 로테이션 시작";

  return (
    <View style={styles.root}>
      <View style={styles.glow} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.x4, paddingBottom: clearance + space.x6 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View>
            <Text style={styles.brand}>MINGLES</Text>
            <Text accessibilityRole="header" style={styles.greeting}>{name}님, 오늘도 반가워요</Text>
          </View>
          <Pressable
            onPress={() => setPopup(true)}
            accessibilityRole="button"
            accessibilityLabel={unread ? `알림 ${unread}건` : "알림"}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Bell color={dark.text} size={21} />
            {unread > 0 ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{Math.min(unread, 99)}</Text></View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroMeta}>
            <View style={styles.liveDot} />
            <Text style={styles.heroEyebrow}>
              {status?.status === "waiting" ? "MATCHING NOW" : "BLIND ROTATION"}
            </Text>
          </View>
          <Text style={styles.heroTitle}>얼굴보다{"\n"}대화가 먼저</Text>
          <Text style={styles.heroBody}>
            {status?.status === "waiting"
              ? `현재 ${status.waitingCount ?? 1}/${status.requiredCount}명 · 예상 ${status.estimatedWaitMinutes ?? 1}분 내외`
              : "가려진 목소리에서 시작해 서로 원할 때만 한 단계씩 가까워져요."}
          </Text>
          <DoodleButton title={actionLabel} onPress={openMatch} variant="primary" tone="dark" />
          <View style={styles.trustRow}>
            <TrustStep icon={<Mic2 color={dark.accent} size={16} />} label="변조 음성" />
            <View style={styles.trustLine} />
            <TrustStep icon={<Sparkles color={dark.gold} size={16} />} label="목소리" />
            <View style={styles.trustLine} />
            <TrustStep icon={<Video color={dark.success} size={16} />} label="얼굴 공개" />
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>이어서 하기</Text>
          <ShieldCheck color={dark.success} size={18} />
        </View>
        <View style={styles.quickGrid}>
          <QuickAction
            icon={<MessageCircle color={dark.accent} size={22} />}
            title="매칭 채팅"
            body="서로 선택한 인연과 대화"
            onPress={() => router.push("/(app)/(tabs)/chats")}
          />
          <QuickAction
            icon={<MapPin color={dark.gold} size={22} />}
            title="데이트 장소"
            body="주변 장소 찾기와 예약"
            onPress={() => router.push("/(app)/(tabs)/naver-reserve")}
          />
        </View>

        <View style={styles.safetyNote}>
          <ShieldCheck color={dark.successBright} size={20} />
          <View style={styles.safetyText}>
            <Text style={styles.safetyTitle}>안전이 먼저예요</Text>
            <Text style={styles.safetyBody}>실명 인증 · 상호 선택 · 언제든 신고 및 차단</Text>
          </View>
        </View>
      </ScrollView>

      <NotificationsPopup
        visible={popup}
        onClose={() => setPopup(false)}
        onChanged={refresh}
      />
    </View>
  );
}

function TrustStep({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <View style={styles.trustStep}>{icon}<Text style={styles.trustLabel}>{label}</Text></View>;
}

function QuickAction({
  icon,
  title,
  body,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${body}`}
      style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
    >
      <View style={styles.quickIcon}>{icon}</View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickBody}>{body}</Text>
      <ChevronRight color={dark.textMuted} size={18} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dark.bg },
  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -120,
    right: -90,
    backgroundColor: dark.glow,
    opacity: 0.45,
  },
  content: {
    width: "100%",
    maxWidth: layout.contentMax,
    alignSelf: "center",
    paddingHorizontal: layout.screenGutter,
    gap: space.x5,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { ...type.caption, color: dark.label, letterSpacing: 2 },
  greeting: { ...type.heading, color: dark.text, marginTop: 2 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: dark.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { ...type.caption, fontSize: 10, lineHeight: 13, color: dark.onDanger },
  heroCard: {
    padding: space.x5,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    gap: space.x4,
    overflow: "hidden",
  },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: dark.accent },
  heroEyebrow: { ...type.caption, color: dark.accent, letterSpacing: 1.2 },
  heroTitle: { fontFamily: serifFont, fontSize: 35, lineHeight: 43, color: dark.heading },
  heroBody: { ...type.body, color: dark.textMuted },
  trustRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  trustStep: { alignItems: "center", gap: space.x1, minWidth: 64 },
  trustLabel: { ...type.caption, fontSize: 11, color: dark.textMuted },
  trustLine: { flex: 1, height: 1, backgroundColor: dark.line, marginHorizontal: space.x1 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  sectionTitle: { ...type.heading, color: dark.text },
  quickGrid: { flexDirection: "row", gap: space.x3 },
  quickCard: {
    flex: 1,
    minHeight: 150,
    padding: space.x4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
  },
  quickIcon: { marginBottom: space.x4 },
  quickTitle: { ...type.label, color: dark.text, paddingRight: space.x5 },
  quickBody: { ...type.caption, color: dark.textMuted, marginTop: space.x1 },
  chevron: { position: "absolute", top: space.x4, right: space.x3 },
  safetyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    padding: space.x4,
    borderRadius: 16,
    backgroundColor: dark.successFill,
  },
  safetyText: { flex: 1 },
  safetyTitle: { ...type.label, color: dark.successBright },
  safetyBody: { ...type.caption, color: dark.textMuted, marginTop: 2 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
