/**
 * AppMap (native) — MapLibre GL Native + OpenFreeMap 타일(키·쿼터·비용 없음, 2026-07-27
 * 네이버 지도 유료화로 교체). guarded require라 네이티브 모듈이 없는 환경(Expo Go)에서는
 * 플레이스홀더로 폴백. `center` 주위 반경 원과 장소 핀을 그린다. 웹은 `AppMap.web.tsx`(Leaflet).
 */
import { View, Text, StyleSheet } from "react-native";
import { colors, type as t, space } from "../lib/theme";
import type { Coords } from "../lib/location";

export type MapPlace = { lat: number; lng: number; title: string };

/** OpenFreeMap 공개 스타일 — 무료·무제한·키 불필요. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapLibre(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@maplibre/maplibre-react-native");
  } catch {
    return null;
  }
}

/** 반경(km) → 화면에 원이 들어오는 대략적 줌 레벨. */
function zoomForRadius(radiusKm: number | null, lat: number): number {
  if (!radiusKm) return 12;
  const metersPerPixel = (radiusKm * 2 * 1000) / 320; // 원 지름이 ~320px 안에 들어오도록
  return Math.log2((40075016.686 * Math.cos((lat * Math.PI) / 180)) / (metersPerPixel * 512));
}

/** 반경 원 GeoJSON 폴리곤(64각형). */
function circlePolygon(center: Coords, radiusKm: number): any {
  const points: [number, number][] = [];
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const theta = (i / 64) * 2 * Math.PI;
    points.push([center.lng + dLng * Math.cos(theta), center.lat + dLat * Math.sin(theta)]);
  }
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [points] },
    properties: {},
  };
}

export function AppMap({
  center,
  radiusKm,
  places,
}: {
  center: Coords;
  radiusKm: number | null;
  places: MapPlace[];
}) {
  const lib = mapLibre();
  if (!lib?.MapView) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>지도를 준비하고 있어요</Text>
      </View>
    );
  }
  const { MapView, Camera, ShapeSource, FillLayer, LineLayer, CircleLayer } = lib;

  const pinFeatures = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [center.lng, center.lat] },
        properties: { kind: "me" },
      },
      ...places.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { kind: "place", title: p.title },
      })),
    ],
  };

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      mapStyle={STYLE_URL}
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled={false}
    >
      <Camera
        defaultSettings={{
          centerCoordinate: [center.lng, center.lat],
          zoomLevel: zoomForRadius(radiusKm, center.lat),
        }}
        centerCoordinate={[center.lng, center.lat]}
        zoomLevel={zoomForRadius(radiusKm, center.lat)}
        animationDuration={350}
      />
      {radiusKm ? (
        <ShapeSource id="radius" shape={circlePolygon(center, radiusKm)}>
          <FillLayer id="radius-fill" style={{ fillColor: colors.accent, fillOpacity: 0.12 }} />
          <LineLayer
            id="radius-line"
            style={{ lineColor: colors.accent, lineWidth: 2, lineOpacity: 0.9 }}
          />
        </ShapeSource>
      ) : null}
      <ShapeSource id="pins" shape={pinFeatures}>
        <CircleLayer
          id="pin-me"
          filter={["==", ["get", "kind"], "me"]}
          style={{
            circleRadius: 7,
            circleColor: colors.accentStrong,
            circleStrokeColor: "#FFFFFF",
            circleStrokeWidth: 2,
          }}
        />
        <CircleLayer
          id="pin-place"
          filter={["==", ["get", "kind"], "place"]}
          style={{
            circleRadius: 6,
            circleColor: colors.ink,
            circleStrokeColor: "#FFFFFF",
            circleStrokeWidth: 2,
          }}
        />
      </ShapeSource>
    </MapView>
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
