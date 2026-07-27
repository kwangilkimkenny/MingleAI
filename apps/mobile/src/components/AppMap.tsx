/**
 * AppMap (native) — MapLibre GL Native + OpenFreeMap 타일(키·쿼터·비용 없음, 2026-07-27
 * 네이버 지도 유료화로 교체). guarded require라 네이티브 모듈이 없는 환경(Expo Go)에서는
 * 플레이스홀더로 폴백. `center` 주위 반경 원과 장소 핀을 그린다. 웹은 `AppMap.web.tsx`(Leaflet).
 *
 * ⚠️ API 버전 주의: v11에서 컴포넌트 이름이 바뀌었다 — `MapView`→`Map`, `ShapeSource`→
 * `GeoJSONSource`(prop `shape`→`data`), `FillLayer`/`LineLayer`/`CircleLayer`→ 공용 `Layer`
 * (`type` + style-spec `paint`), Camera `centerCoordinate`/`zoomLevel`→`center`/`zoom`.
 * v10 이름을 쓰면 require는 성공하는데 컴포넌트가 undefined라 "지도를 준비하고 있어요"에서
 * 영원히 멈춘다(2026-07-27 버그).
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

/** 반경(km) → 원이 화면에 들어오는 대략적 줌 레벨. */
function zoomForRadius(radiusKm: number | null, lat: number): number {
  if (!radiusKm) return 13;
  const metersPerPixel = (radiusKm * 2 * 1000) / 320; // 지름이 ~320px 안에 들어오도록
  const zoom = Math.log2(
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (metersPerPixel * 512),
  );
  return Math.max(3, Math.min(18, zoom));
}

/** 반경 원 GeoJSON 폴리곤(64각형). */
function circleFeature(center: Coords, radiusKm: number): any {
  const points: [number, number][] = [];
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const theta = (i / 64) * 2 * Math.PI;
    points.push([center.lng + dLng * Math.cos(theta), center.lat + dLat * Math.sin(theta)]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [points] }, properties: {} };
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
  const MapComponent = lib?.Map;
  if (!MapComponent) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>지도를 준비하고 있어요</Text>
      </View>
    );
  }
  const { Camera, GeoJSONSource, Layer } = lib;
  const zoom = zoomForRadius(radiusKm, center.lat);

  const pinFeatures: any = {
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
    <MapComponent
      style={StyleSheet.absoluteFill}
      mapStyle={STYLE_URL}
      logo={false}
      attribution={false}
      compass={false}
    >
      <Camera
        initialViewState={{ center: [center.lng, center.lat], zoom }}
        center={[center.lng, center.lat]}
        zoom={zoom}
        animationDuration={350}
      />
      {radiusKm ? <GeoJSONSource id="radius" data={circleFeature(center, radiusKm)} /> : null}
      <GeoJSONSource id="pins" data={pinFeatures} />
      {radiusKm ? (
        <Layer
          id="radius-fill"
          type="fill"
          source="radius"
          paint={{ "fill-color": colors.accent, "fill-opacity": 0.12 }}
        />
      ) : null}
      {radiusKm ? (
        <Layer
          id="radius-line"
          type="line"
          source="radius"
          paint={{ "line-color": colors.accent, "line-width": 2, "line-opacity": 0.9 }}
        />
      ) : null}
      <Layer
        id="pin-place"
        type="circle"
        source="pins"
        filter={["==", ["get", "kind"], "place"]}
        paint={{
          "circle-radius": 6,
          "circle-color": colors.ink,
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2,
        }}
      />
      <Layer
        id="pin-me"
        type="circle"
        source="pins"
        filter={["==", ["get", "kind"], "me"]}
        paint={{
          "circle-radius": 7,
          "circle-color": colors.accentStrong,
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2,
        }}
      />
    </MapComponent>
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
