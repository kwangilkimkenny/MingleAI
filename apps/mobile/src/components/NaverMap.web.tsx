/**
 * NaverMap (web fallback) — the Naver Maps SDK is native-only, so on web (the Metro dev surface)
 * we render a labelled placeholder. The nearby list beside it carries the real function on web.
 */
import { View, Text, StyleSheet } from "react-native";
import { colors, type as t, space } from "../lib/theme";
import type { Coords } from "../lib/location";

export type MapPlace = { lat: number; lng: number; title: string };

export function NaverMap(_props: { center: Coords; radiusKm: number | null; places: MapPlace[] }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>지도는 앱에서 표시돼요</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fill,
    padding: space.x5,
  },
  placeholderText: { ...t.caption, color: colors.grayMid, textAlign: "center" },
});
