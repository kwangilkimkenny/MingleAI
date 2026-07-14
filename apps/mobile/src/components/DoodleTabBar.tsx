/**
 * Floating hand-drawn tab bar — replaces the stock RN bottom tab bar. A single
 * WobbleBox (SVG wonky border + hard ink offset shadow) floats 12px above the
 * bottom edge; tabs stay exactly the 5 from _layout.tsx (routing untouched).
 * Active = colors.accent icon+label (CLAUDE.md single point-color rule),
 * inactive = colors.grayMid.
 */
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WobbleBox } from "./DoodleSvg";
import { colors, fonts } from "../lib/theme";

const BAR_RADIUS = {
  borderTopLeftRadius: 19,
  borderTopRightRadius: 22,
  borderBottomRightRadius: 18,
  borderBottomLeftRadius: 21,
};

export function DoodleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
      pointerEvents="box-none"
    >
      <WobbleBox radius={BAR_RADIUS} seed={11} shadow strokeWidth={2.4} contentStyle={styles.row}>
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const focused = state.index === i;
          const color = focused ? colors.accent : colors.grayMid;
          const label = typeof options.title === "string" ? options.title : route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
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
              {options.tabBarIcon ? options.tabBarIcon({ focused, color, size: 23 }) : null}
              <Text style={[styles.label, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </WobbleBox>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, bottom: 0, backgroundColor: "transparent" },
  row: { flexDirection: "row", alignItems: "center", height: 60 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { fontFamily: fonts.display, fontSize: 11 },
});
