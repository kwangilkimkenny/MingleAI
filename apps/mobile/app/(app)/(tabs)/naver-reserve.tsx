/**
 * 데이트 맛집 탭 — 네이버 로컬 검색 기반 추천. 현위치의 동네(area)를 서버가 역지오코딩해
 * "동네 + 카테고리"로 검색하고, 결과를 거리순으로 보여준다. 카테고리 칩(데이트 프리셋)은
 * 썸존(리스트 아래·지도 위가 아닌 하단)에 두고, 행을 탭하면 네이버 지도에서 바로 연다.
 */
import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { MapPin } from "lucide-react-native";
import { getNearbyPlaces, type NaverPlace } from "@mingle/client-core";
import { dark, doodle, space, type as t } from "../../../src/lib/theme";
import { serifFont } from "../../../src/lib/serif";
import { StateView } from "../../../src/components/Foundation";
import { AppScreen } from "../../../src/components/AppScreen";
import { AppMap, type MapPlace } from "../../../src/components/AppMap";
import { getCurrentCoords, type Coords } from "../../../src/lib/location";

/** 데이트 맥락 카테고리 프리셋 — query로 그대로 들어간다. */
const CATEGORIES: { key: string; label: string }[] = [
  { key: "맛집", label: "전체" },
  { key: "카페", label: "카페" },
  { key: "레스토랑", label: "레스토랑" },
  { key: "와인바", label: "와인바" },
  { key: "이자카야", label: "이자카야" },
  { key: "브런치", label: "브런치" },
];

/** Naver local-search mapx/mapy are WGS84 ×1e7 strings → decimal degrees. */
function coordsOf(p: NaverPlace): Coords | null {
  const lat = Number(p.mapy) / 1e7;
  const lng = Number(p.mapx) / 1e7;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function distanceLabel(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

/** 카테고리 원문("음식점>일식>초밥,롤")에서 마지막 세그먼트만 배지로. */
function categoryLeaf(category: string): string {
  const parts = category.split(">").filter(Boolean);
  return parts[parts.length - 1] ?? category;
}

/** 링크는 업체 홈페이지(인스타 등)일 수 있어 무시하고 항상 네이버 지도 검색으로 통일. */
function openInNaver(p: NaverPlace) {
  void Linking.openURL(`https://map.naver.com/p/search/${encodeURIComponent(p.title)}`);
}

type Row = NaverPlace & { km: number | null };

export default function NaverReserve() {
  const [phase, setPhase] = useState<"loading" | "ready" | "unconfigured" | "error">("loading");
  const [rows, setRows] = useState<Row[]>([]);
  const [area, setArea] = useState<string | null>(null);
  const [category, setCategory] = useState("맛집");
  const [refreshing, setRefreshing] = useState(false);
  const centerRef = useRef<Coords | null>(null);
  const seq = useRef(0);

  const fetchPlaces = useCallback(async (cat: string, quiet: boolean) => {
    const mySeq = ++seq.current;
    if (!quiet) setPhase("loading");
    try {
      if (!centerRef.current) centerRef.current = await getCurrentCoords();
      const center = centerRef.current;
      const res = await getNearbyPlaces(cat, center ?? undefined);
      if (mySeq !== seq.current) return;
      const withKm: Row[] = res.places.map((p) => {
        const c = coordsOf(p);
        return { ...p, km: center && c ? distanceKm(center, c) : null };
      });
      withKm.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
      setRows(withKm);
      setArea(res.area);
      setPhase(res.configured ? "ready" : "unconfigured");
    } catch {
      if (mySeq === seq.current) setPhase("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchPlaces(category, rows.length > 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category, fetchPlaces]),
  );

  function onPickCategory(key: string) {
    if (key === category) return;
    setCategory(key);
    void fetchPlaces(key, false);
  }

  async function onRefresh() {
    setRefreshing(true);
    centerRef.current = null; // 위치도 새로 잡는다
    await fetchPlaces(category, true);
    setRefreshing(false);
  }

  if (phase === "unconfigured") {
    return (
      <AppScreen tabScreen tone="dark" body="plain">
        <StateView title="준비 중이에요" body="곧 근처 맛집을 지도에서 찾고 바로 예약할 수 있게 돼요." dark />
      </AppScreen>
    );
  }
  if (phase === "error") {
    return (
      <AppScreen tabScreen tone="dark" body="plain">
        <StateView title="맛집을 불러오지 못했어요" actionLabel="다시 시도" onAction={() => void fetchPlaces(category, false)} dark />
      </AppScreen>
    );
  }

  const center = centerRef.current;
  const pins = rows
    .map((p) => {
      const c = coordsOf(p);
      return c ? ({ ...c, title: p.title } as MapPlace) : null;
    })
    .filter((p): p is MapPlace => p !== null);

  return (
    <AppScreen tabScreen tone="dark" body="plain">
      {center ? (
        <View style={styles.map}>
          <AppMap center={center} radiusKm={null} places={pins} />
          {area ? (
            <View style={styles.areaBadge}>
              <MapPin color={dark.accent} size={13} strokeWidth={2} />
              <Text style={styles.areaText}>{area}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "loading" ? (
        <View style={styles.flex}>
          <StateView title="주변을 둘러보고 있어요" loading dark />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p, i) => `${p.title}-${i}`}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dark.text} />
          }
          ListEmptyComponent={<StateView title="이 카테고리는 근처에 없어요" dark />}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, 네이버 지도에서 보기`}
              onPress={() => openInNaver(item)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.km !== null ? <Text style={styles.cardKm}>{distanceLabel(item.km)}</Text> : null}
              </View>
              <View style={styles.cardMeta}>
                <View style={styles.leafBadge}>
                  <Text style={styles.leafText}>{categoryLeaf(item.category)}</Text>
                </View>
                <Text style={styles.cardAddr} numberOfLines={1}>
                  {item.roadAddress || item.address}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* 카테고리 칩 — 썸존(하단) 고정, 가로 스크롤 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipBar}
        contentContainerStyle={styles.chipRow}
      >
        {CATEGORIES.map((c) => {
          const on = c.key === category;
          return (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onPickCategory(c.key)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { flexGrow: 1, paddingBottom: space.x3 },
  gap: { height: space.x2 },
  map: {
    height: 180,
    marginBottom: space.x3,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: doodle.border,
    borderColor: dark.border,
  },
  areaBadge: {
    position: "absolute",
    left: space.x3,
    top: space.x3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.x3,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: dark.bg,
    borderWidth: 1,
    borderColor: dark.border,
  },
  areaText: { ...t.caption, color: dark.text },
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    paddingHorizontal: space.x4,
    paddingVertical: space.x3,
    gap: 6,
  },
  pressed: { opacity: 0.7 },
  cardTop: { flexDirection: "row", alignItems: "baseline", gap: space.x2 },
  cardTitle: { flex: 1, fontFamily: serifFont, fontSize: 17, color: dark.text },
  cardKm: { ...t.caption, color: dark.accent },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  leafBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: dark.surfaceHi,
  },
  leafText: { ...t.caption, color: dark.textMuted },
  cardAddr: { ...t.caption, color: dark.textMuted, flex: 1 },
  chipBar: { flexGrow: 0, marginTop: space.x2 },
  chipRow: { gap: space.x2, paddingVertical: space.x1 },
  chip: {
    paddingHorizontal: space.x4,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: dark.surface,
    borderWidth: 1,
    borderColor: dark.border,
  },
  chipOn: { backgroundColor: dark.surfaceHi, borderColor: dark.text },
  chipText: { ...t.label, color: dark.textMuted },
  chipTextOn: { color: dark.text },
});
