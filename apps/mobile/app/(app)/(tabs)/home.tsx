import { useCallback, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Bell, Heart } from "lucide-react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import { getReceivedProposals, getUnreadCount } from "@mingle/client-core";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { colors, fonts, masterpiece } from "../../../src/lib/theme";
import { serifFont } from "../../../src/lib/serif";

const MAN = require("../../../assets/images/renaissance-man-cutout.png");
const WOMAN = require("../../../assets/images/renaissance-woman-cutout.png");

/**
 * Home — full-bleed masterpiece composition. Two Renaissance cutouts reach across the screen
 * (man top-left, woman mirrored bottom-right) and a central MATCH button connects them. Cream
 * paper + halftone dots; the line-art system stays on the functional screens. Proposals /
 * notifications live as small top-right affordances (the old "최근" list is gone).
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const clearance = useTabBarClearance();
  const { width: W, height: H } = useWindowDimensions();
  // Both figures placed with an explicit top (bottom-anchoring mis-resolves on RN Web here).
  const figW = W * 0.62;
  const manH = figW * (1405 / 1024);
  const womanH = figW * (1400 / 1024);
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
      {/* halftone dot field */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id="home-dots" width={9} height={9} patternUnits="userSpaceOnUse">
            <Circle cx={1.4} cy={1.4} r={1.15} fill={masterpiece.dot} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#home-dots)" opacity={0.5} />
      </Svg>

      {/* man — top-left, bleeding off the left edge */}
      <Image
        source={MAN}
        resizeMode="contain"
        style={[styles.fig, { width: figW, height: manH, left: -18, top: insets.top - 6 }]}
      />

      {/* woman — bottom-right, mirrored so she faces in */}
      <Image
        source={WOMAN}
        resizeMode="contain"
        style={[
          styles.figFlip,
          { width: figW, height: womanH, right: -18, top: H - clearance - womanH + 34 },
        ]}
      />

      {/* top-right: proposals + notifications (old 최근 entries preserved) */}
      <View style={[styles.topbar, { top: insets.top + 6 }]}>
        <IconDot icon={<Heart color={colors.ink} size={20} strokeWidth={1.9} />} n={pending} label="프로포즈" onPress={() => router.push("/proposals")} />
        <IconDot icon={<Bell color={colors.ink} size={20} strokeWidth={1.9} />} n={unread} label="알림" onPress={() => router.push("/notifications")} />
      </View>

      {/* center MATCH button connecting the two figures */}
      <View style={styles.center} pointerEvents="box-none">
        <Pressable
          onPress={onMatch}
          accessibilityRole="button"
          accessibilityLabel="블라인드 데이트 매칭 시작"
          style={({ pressed }) => [styles.matchRing, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <View style={styles.match}>
            <Text style={styles.matchText}>MATCH</Text>
            <Text style={styles.matchSub}>로테이션 소개팅</Text>
          </View>
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
  root: { flex: 1, backgroundColor: masterpiece.cream, overflow: "hidden" },
  fig: { position: "absolute" },
  figFlip: { position: "absolute", transform: [{ scaleX: -1 }] },
  topbar: { position: "absolute", right: 16, flexDirection: "row", gap: 10, zIndex: 5 },
  iconDot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: masterpiece.cream,
    borderWidth: 1,
    borderColor: masterpiece.pillGhostBorder,
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
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  matchRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(244,241,234,0.55)",
    shadowColor: "#221D18",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  match: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: masterpiece.inkDeep,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  matchText: {
    fontFamily: serifFont,
    fontSize: 26,
    letterSpacing: 2,
    color: masterpiece.onPill,
  },
  matchSub: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 0.5, color: "rgba(244,241,234,0.72)" },
});
