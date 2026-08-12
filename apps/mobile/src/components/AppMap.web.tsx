/**
 * AppMap (web) — 웹 프리뷰용 Leaflet + CARTO dark_all 래스터(키 불필요). 반경 원과 장소 핀을 그려
 * 네이티브 `AppMap.tsx`(MapLibre + OpenFreeMap **dark**)와 동형. Leaflet은 첫 마운트 때 CDN lazy 로드.
 */
import { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { colors, dark } from "../lib/theme";
import type { Coords } from "../lib/location";

export type MapPlace = { lat: number; lng: number; title: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

let leafletPromise: Promise<any> | null = null;
/** Load Leaflet once (CSS + JS injected into <head>), resolving to window.L. */
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null;
    if (existing && w.L) return resolve(w.L);
    const script = existing ?? document.createElement("script");
    script.src = LEAFLET_JS;
    script.onload = () => resolve(w.L);
    script.onerror = () => reject(new Error("leaflet load failed"));
    if (!existing) document.body.appendChild(script);
  });
  return leafletPromise;
}

export function AppMap({
  center,
  radiusKm,
  places,
  fitKm,
}: {
  center: Coords;
  radiusKm: number | null;
  places: MapPlace[];
  /** 원 없이 줌만 이 반경에 맞춘다(네이티브와 동형). */
  fitKm?: number | null;
}) {
  const hostRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);

  function drawOverlays(L: any, map: any) {
    for (const o of overlaysRef.current) map.removeLayer(o);
    overlaysRef.current = [];
    // center pin
    const pin = L.circleMarker([center.lat, center.lng], {
      radius: 7,
      color: dark.bg,
      weight: 2,
      fillColor: colors.accentStrong,
      fillOpacity: 1,
    }).addTo(map);
    overlaysRef.current.push(pin);
    // radius circle
    if (radiusKm) {
      const circle = L.circle([center.lat, center.lng], {
        radius: radiusKm * 1000,
        color: colors.accent,
        weight: 2,
        fillColor: colors.accent,
        fillOpacity: 0.12,
      }).addTo(map);
      overlaysRef.current.push(circle);
      map.fitBounds(circle.getBounds(), { padding: [24, 24] });
    } else if (fitKm) {
      // 원은 안 그리되 핀이 다 들어오도록 줌만 맞춘다. 레이어를 만들어 getBounds()를 부르면
      // 지도에 붙지 않은 circle은 `_map`이 없어 터진다(`layerPointToLatLng of undefined`).
      map.fitBounds(L.latLng(center.lat, center.lng).toBounds(fitKm * 2000), { padding: [24, 24] });
    }
    // place markers
    for (const p of places) {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 6,
        // 다크 타일에선 잉크 핀이 잠긴다 — 크림 채움 + 어두운 테두리.
        color: dark.bg,
        weight: 2,
        fillColor: dark.pill,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip(p.title, { direction: "top" });
      overlaysRef.current.push(m);
    }
  }

  // init once
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !hostRef.current || mapRef.current) return;
        const map = L.map(hostRef.current, { zoomControl: false, attributionControl: true }).setView(
          [center.lat, center.lng],
          13,
        );
        // 다크 UI 안에 밝은 OSM 타일이 박히면 명도가 튄다 — CARTO dark_all 래스터를 쓴다.
        // 네이티브(MapLibre)는 OpenFreeMap dark 스타일. 둘 다 키 불필요, 출처 표기 필수라 켜 둔다.
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap · © CARTO",
        }).addTo(map);
        mapRef.current = map;
        // container may size after mount — recompute so tiles fill the box
        setTimeout(() => map.invalidateSize(), 60);
        drawOverlays(L, map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw circle/markers + recenter when props change
  useEffect(() => {
    const w = typeof window !== "undefined" ? (window as any) : null;
    if (!w?.L || !mapRef.current) return;
    mapRef.current.setView([center.lat, center.lng], mapRef.current.getZoom() ?? 13);
    drawOverlays(w.L, mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, radiusKm, fitKm, places]);

  return (
    <View style={styles.fill}>
      <View ref={hostRef} style={styles.fill} />
    </View>
  );
}

const styles = StyleSheet.create({
  // 타일이 오기 전 흰 판이 번쩍이지 않게 바탕도 다크로.
  fill: { flex: 1, minHeight: 200, backgroundColor: dark.surface },
});
