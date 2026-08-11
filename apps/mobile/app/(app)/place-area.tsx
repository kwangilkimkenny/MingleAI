/**
 * 맛집 탭의 위치 지정 — "지금 내가 있는 곳"이 아니라 "만나기로 한 동네"를 고르는 화면
 * (2026-08-06 지시). 동네·역 이름으로 검색해 고르거나, 현위치를 그대로 쓸 수 있다.
 * 고른 위치는 저장되어 다음에 탭을 열 때도 유지된다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LocateFixed, MapPin, X } from "lucide-react-native";
import { searchAreas, type AreaHit } from "@mingle/client-core";
import { AppScreen } from "../../src/components/AppScreen";
import { StateView } from "../../src/components/Foundation";
import { AppMap } from "../../src/components/AppMap";
import { getCurrentCoords } from "../../src/lib/location";
import { savePlaceArea, loadPlaceArea, type AreaScope, type PlaceArea } from "../../src/lib/place-area";
import { dark, space, type as t } from "../../src/lib/theme";
import { serifFont } from "../../src/lib/serif";

/** Nominatim은 초당 1회 권고 — 타이핑마다 때리지 않게 넉넉히 기다린다. */
const DEBOUNCE_MS = 600;

/** 이 화면의 모든 행·박스가 공유하는 한 벌의 치수. 검색·현위치·결과 행이 같은 높이·같은 좌측
 *  기준선을 쓰지 않으면 목록이 삐뚤어 보인다(2026-08-11). */
const ROW_HEIGHT = 52;
const ROW_RADIUS = 14;
const ROW_PAD = space.x4;

export default function PlaceAreaScreen() {
  // scope=date면 데이트 약속 장소를 고르는 것 — 맛집 탭의 동네와 따로 저장된다.
  const params = useLocalSearchParams<{ scope?: string }>();
  const scope: AreaScope = params.scope === "date" ? "date" : "places";
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AreaHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [picked, setPicked] = useState<PlaceArea | null>(null);
  const seq = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void loadPlaceArea(scope).then((a) => {
      if (alive.current && a) setPicked(a);
    });
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(() => {
      searchAreas(q)
        .then((res) => {
          if (alive.current && my === seq.current) setHits(res.areas);
        })
        .catch(() => {
          if (alive.current && my === seq.current) setHits([]);
        })
        .finally(() => {
          if (alive.current && my === seq.current) setBusy(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const commit = useCallback(
    async (area: PlaceArea) => {
      await savePlaceArea(area, scope);
      router.back();
    },
    [scope],
  );

  async function useCurrent() {
    setLocating(true);
    try {
      const coords = await getCurrentCoords();
      if (!coords) return;
      await commit({ label: "현위치", lat: coords.lat, lng: coords.lng });
    } finally {
      if (alive.current) setLocating(false);
    }
  }

  return (
    <AppScreen tone="dark" header={{ title: scope === "date" ? "어디서 만날까요?" : "어디서 만나요?", back: true }}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="동네·역 이름 (예: 홍대입구역)"
          placeholderTextColor={dark.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          accessibilityLabel="동네 검색"
        />
        {busy ? (
          <ActivityIndicator color={dark.textMuted} size="small" />
        ) : query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
            hitSlop={10}
            onPress={() => setQuery("")}
          >
            <X color={dark.textMuted} size={18} strokeWidth={1.75} />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="현위치로 설정"
        onPress={() => void useCurrent()}
        style={({ pressed }) => [styles.currentRow, pressed && styles.pressed]}
      >
        <LocateFixed color={dark.accent} size={19} strokeWidth={1.75} />
        <Text style={styles.currentText}>현위치로 설정</Text>
        {locating ? <ActivityIndicator color={dark.textMuted} size="small" /> : null}
      </Pressable>

      {query.trim().length < 2 ? (
        <View style={styles.preview}>
          {picked ? (
            <>
              <View style={styles.previewMap}>
                <AppMap center={{ lat: picked.lat, lng: picked.lng }} radiusKm={null} places={[]} />
              </View>
              <Text style={styles.previewLabel}>지금 기준: {picked.label}</Text>
            </>
          ) : (
            <StateView
              title="만날 동네를 골라 주세요"
              body={
                scope === "date"
                  ? "고른 동네의 실제 가게로 데이트 코스를 짜드려요."
                  : "지정한 동네를 기준으로 데이트 맛집을 찾아드려요."
              }
              dark
            />
          )}
        </View>
      ) : busy && hits.length === 0 ? (
        <StateView title="동네를 찾고 있어요" loading dark />
      ) : hits.length === 0 ? (
        <StateView title="검색 결과가 없어요" body="동네나 역 이름으로 다시 찾아보세요." dark />
      ) : (
        <View style={styles.hits}>
          {hits.map((h, i) => (
            <Pressable
              key={`${h.label}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${h.label} 선택`}
              onPress={() => void commit({ label: h.label, lat: h.lat, lng: h.lng })}
              style={({ pressed }) => [
                styles.hitRow,
                i === hits.length - 1 && styles.hitRowLast,
                pressed && styles.pressed,
              ]}
            >
              <MapPin color={dark.textMuted} size={18} strokeWidth={1.75} />
              <View style={styles.hitText}>
                <Text style={styles.hitLabel} numberOfLines={1}>
                  {h.label}
                </Text>
                {h.detail ? (
                  <Text style={styles.hitDetail} numberOfLines={1}>
                    {h.detail}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </AppScreen>
  );
}

const box = {
  // minHeight가 아니라 고정 높이 — 아이콘이 든 행과 텍스트만 든 행이 몇 px 어긋나 보였다.
  height: ROW_HEIGHT,
  paddingHorizontal: ROW_PAD,
  borderRadius: ROW_RADIUS,
  borderWidth: 1,
  borderColor: dark.border,
  backgroundColor: dark.surface,
} as const;

const styles = StyleSheet.create({
  // 검색 박스 = 현위치 박스와 같은 규격(높이·라운드·좌우 패딩). 돋보기 아이콘은 없앴다 —
  // 자리표시자가 이미 무엇을 치는지 말한다(2026-08-11).
  searchRow: { ...box, flexDirection: "row", alignItems: "center", gap: space.x2 },
  searchInput: { flex: 1, ...t.body, color: dark.text, paddingVertical: 0 },
  currentRow: {
    ...box,
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    marginTop: space.x2,
  },
  currentText: { flex: 1, ...t.label, color: dark.text },
  pressed: { opacity: 0.7 },
  preview: { gap: space.x2, marginTop: space.x4 },
  previewMap: {
    height: 168,
    borderRadius: ROW_RADIUS,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: dark.border,
  },
  previewLabel: { ...t.caption, color: dark.textMuted, textAlign: "center" },
  hits: { marginTop: space.x4 },
  // 결과 행도 같은 높이·같은 좌측 기준선. 목록이 박스들과 한 줄로 선다.
  hitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    minHeight: ROW_HEIGHT,
    paddingHorizontal: ROW_PAD,
    borderBottomWidth: 1,
    borderBottomColor: dark.line,
  },
  hitRowLast: { borderBottomWidth: 0 },
  hitText: { flex: 1, gap: 2 },
  hitLabel: { fontFamily: serifFont, fontSize: 16, color: dark.text },
  hitDetail: { ...t.caption, color: dark.textMuted },
});
