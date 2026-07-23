/**
 * NaverMap (native) — Naver Maps SDK (`@mj-studio/react-native-naver-map`), loaded with a guarded
 * require so the app builds before the native module + `EXPO_PUBLIC_NAVER_MAP_KEY` are set up (the
 * SDK is a native module → only renders in an EAS dev build, never Expo Go/web). Until the SDK is
 * installed it falls back to a labelled placeholder. Draws a radius circle around `center` and a
 * pin per place. Web uses `NaverMap.web.tsx`.
 */
import { View, Text, StyleSheet } from "react-native";
import { colors, type as t, space } from "../lib/theme";
import type { Coords } from "../lib/location";

export type MapPlace = { lat: number; lng: number; title: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
function naverMapLib(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@mj-studio/react-native-naver-map");
  } catch {
    return null;
  }
}

export function NaverMap({
  center,
  radiusKm,
  places,
}: {
  center: Coords;
  radiusKm: number | null;
  places: MapPlace[];
}) {
  const lib = naverMapLib();
  if (!lib?.NaverMapView) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>지도는 앱 빌드에서 표시돼요</Text>
      </View>
    );
  }
  const { NaverMapView, NaverMapMarkerOverlay, NaverMapCircleOverlay } = lib;
  return (
    <NaverMapView
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {radiusKm ? (
        <NaverMapCircleOverlay
          latitude={center.lat}
          longitude={center.lng}
          radius={radiusKm * 1000}
          color="rgba(225,29,72,0.12)"
          outlineColor={colors.accent}
          outlineWidth={2}
        />
      ) : null}
      {places.map((p, i) => (
        <NaverMapMarkerOverlay
          key={`${p.lat},${p.lng},${i}`}
          latitude={p.lat}
          longitude={p.lng}
          caption={{ text: p.title }}
        />
      ))}
    </NaverMapView>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fill,
    padding: space.x5,
  },
  placeholderText: { ...t.caption, color: colors.grayMid, textAlign: "center" },
});
