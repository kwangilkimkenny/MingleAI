/**
 * Bottom tab bar — a full-width bar anchored to the bottom edge (replaces the earlier floating
 * rounded pill). White card surface with a soft rose top hairline + a subtle upward shadow; the
 * bar background fills all the way to the screen edge and reserves safe-area padding so the row
 * sits above the home indicator. Tabs stay exactly the 5 from _layout.tsx (routing untouched).
 * Active = colors.accent icon+label, inactive = colors.grayMid.
 */
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, dark, fonts } from "../lib/theme";

export const TAB_BAR_ROW_HEIGHT = 60;

/** Bottom clearance tab screens must reserve so content scrolls clear of the bottom bar. */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_ROW_HEIGHT + insets.bottom + 8;
}

export function DoodleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.row}>
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          // Skip routes hidden from the bar (href: null → no tabBarIcon), keeping index aligned.
          if (!options.tabBarIcon) return null;
          const focused = state.index === i;
          const color = focused ? dark.accent : dark.textMuted;
          const label = typeof options.title === "string" ? options.title : route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const e = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
              }}
              onLongPress={() => {
                navigation.emit({ type: "tabLongPress", target: route.key });
              }}
              style={styles.tab}
            >
              {options.tabBarIcon ? options.tabBarIcon({ focused, color, size: 26 }) : null}
              {options.tabBarBadge !== undefined ? (
                <View style={styles.badge} accessibilityLabel={`읽지 않은 알림 ${options.tabBarBadge}개`}>
                  <Text style={styles.badgeText}>{options.tabBarBadge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: dark.surface,
    borderTopWidth: 1,
    borderTopColor: dark.line,
    // Subtle upward lift so content scrolling under the bar reads as behind it.
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  row: { flexDirection: "row", alignItems: "stretch", height: TAB_BAR_ROW_HEIGHT },
  // 아이콘만 — 행 전체(60px)를 채워 44px 최소 터치 타깃 보장. 활성 = 아이콘 색(블러쉬)으로만 표시.
  tab: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", gap: 5 },
  badge: {
    position: "absolute",
    top: 8,
    right: "28%",
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.accentStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.bodySemibold, fontSize: 10, lineHeight: 13, color: colors.onAccent },
});
