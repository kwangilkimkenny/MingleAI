/**
 * AppMap (web) — 웹 프리뷰용 Leaflet + OpenStreetMap(키 불필요). 반경 원과 장소 핀을 그려
 * 네이티브 `AppMap.tsx`(MapLibre + OpenFreeMap)와 동형. Leaflet은 첫 마운트 때 CDN에서 lazy 로드.
 */
import { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, type as t, space } from "../lib/theme";
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
}: {
  center: Coords;
  radiusKm: number | null;
  places: MapPlace[];
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
      color: "#fff",
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
    }
    // place markers
    for (const p of places) {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 6,
        color: "#fff",
        weight: 2,
        fillColor: colors.ink,
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
        const map = L.map(hostRef.current, { zoomControl: false, attributionControl: false }).setView(
          [center.lat, center.lng],
          13,
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
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
  }, [center.lat, center.lng, radiusKm, places]);

  return (
    <View style={styles.fill}>
      <View ref={hostRef} style={styles.fill} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 200, backgroundColor: colors.fill },
});
