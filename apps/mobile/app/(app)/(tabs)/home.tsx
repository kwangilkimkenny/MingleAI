import { useCallback, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Bell, Heart } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { getReceivedProposals, getUnreadCount } from "@mingle/client-core";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { colors, fonts, masterpiece } from "../../../src/lib/theme";
import { serifFont } from "../../../src/lib/serif";

const SCENE = require("../../../assets/images/renaissance-modern-cafe-date.png");

/**
 * Home — a single cinematic scene (Renaissance couple on a modern coffee date = the concept made
 * literal: 로테이션 블라인드 소개팅으로 만나 알아간 두 사람). Full-bleed image + bottom scrim, a
 * serif concept line and the MATCH CTA over it; proposals / notifications as light top-right icons.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const clearance = useTabBarClearance();
  const [pending, setPending] = useState(0);
  const [unread, setUnread] = useState(0);
  const navigatingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      navigatingRef.current = false;
      let alive = true;
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

  function onMatch() {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    router.push("/(app)/speed-date");
  }

  return (
    <View style={styles.root}>
      {/* full-width scene, natural height → the whole couple is visible (native fits to width) */}
      <Image source={SCENE} resizeMode="cover" style={styles.scene} />

      {/* bottom scrim for legible light copy */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="home-scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1A120C" stopOpacity={0} />
            <Stop offset="0.55" stopColor="#1A120C" stopOpacity={0} />
            <Stop offset="1" stopColor="#1A120C" stopOpacity={0.82} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#home-scrim)" />
      </Svg>

      {/* top-right: proposals + notifications */}
      <View style={[styles.topbar, { top: insets.top + 6 }]}>
        <IconDot icon={<Heart color="#FFF" size={20} strokeWidth={2} />} n={pending} label="프로포즈" onPress={() => router.push("/proposals")} />
        <IconDot icon={<Bell color="#FFF" size={20} strokeWidth={2} />} n={unread} label="알림" onPress={() => router.push("/notifications")} />
      </View>

      {/* bottom: concept line + MATCH */}
      <View style={[styles.bottom, { paddingBottom: clearance + 8 }]}>
        <Text style={styles.eyebrow}>로테이션 블라인드 소개팅</Text>
        <Text style={styles.headline}>얼굴보다{"\n"}대화가 먼저</Text>
        <Pressable
          onPress={onMatch}
          accessibilityRole="button"
          accessibilityLabel="블라인드 데이트 매칭 시작"
          style={({ pressed }) => [styles.match, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.matchText}>MATCH</Text>
          <Text style={styles.matchSub}>로테이션 소개팅 시작</Text>
        </Pressable>
      </View>
    </View>
  );
}

function IconDot({
  icon,
  n,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  n: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={n > 0 ? `${label} ${n}건` : label}
      style={({ pressed }) => [styles.iconDot, pressed && { opacity: 0.7 }]}
    >
      {icon}
      {n > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{n}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1A120C" },
  // Full width, natural aspect → the entire couple shows (native fits to width; the strip artifact
  // was RN-Web only). The scene sits at the top; the dark root + scrim carry the copy below it.
  scene: { width: "100%", aspectRatio: 1023 / 1537 },
  topbar: { position: "absolute", right: 16, flexDirection: "row", gap: 10, zIndex: 5 },
  iconDot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(20,15,10,0.32)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.accentStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.bodySemibold, fontSize: 10, lineHeight: 13, color: colors.onAccent },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 24, gap: 4 },
  eyebrow: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: "rgba(255,247,240,0.75)",
    marginBottom: 4,
  },
  headline: {
    fontFamily: serifFont,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.4,
    color: "#FFF7F0",
  },
  match: {
    marginTop: 16,
    alignSelf: "flex-start",
    minWidth: 200,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 26,
    backgroundColor: masterpiece.cream,
    alignItems: "center",
    gap: 1,
  },
  matchText: { fontFamily: serifFont, fontSize: 20, letterSpacing: 1.5, color: masterpiece.inkDeep },
  matchSub: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 0.3, color: masterpiece.inkSoft },
});
