/**
 * Bottom tab bar — a full-width bar anchored to the bottom edge (replaces the earlier floating
 * rounded pill). White card surface with a soft rose top hairline + a subtle upward shadow; the
 * bar background fills all the way to the screen edge and reserves safe-area padding so the row
 * sits above the home indicator. Tabs stay exactly the 4 from _layout.tsx (routing untouched).
 * Active = colors.accent icon+label, inactive = colors.grayMid.
 */
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, componentTokens, dark, fonts } from "../lib/theme";

export const TAB_BAR_ROW_HEIGHT = componentTokens.tabBar.rowHeight;

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
              {focused ? <View style={styles.activeMark} /> : null}
              {options.tabBarIcon
                ? options.tabBarIcon({ focused, color, size: componentTokens.tabBar.iconSize })
                : null}
              <Text numberOfLines={1} style={[styles.label, focused && styles.labelFocused]}>
                {label}
              </Text>
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
  tab: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", gap: 3 },
  activeMark: {
    position: "absolute",
    top: 0,
    width: 28,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: dark.accent,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: componentTokens.tabBar.labelSize,
    lineHeight: 15,
    color: dark.textMuted,
  },
  labelFocused: { fontFamily: fonts.bodySemibold, color: dark.accentBright },
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
