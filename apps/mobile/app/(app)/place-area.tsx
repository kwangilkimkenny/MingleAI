/**
 * 맛집 탭의 위치 지정 — "지금 내가 있는 곳"이 아니라 "만나기로 한 동네"를 고르는 화면
 * (2026-08-06 지시). 동네·역 이름으로 검색해 고르거나, 현위치를 그대로 쓸 수 있다.
 * 고른 위치는 저장되어 다음에 탭을 열 때도 유지된다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { LocateFixed, MapPin, Search, X } from "lucide-react-native";
import { searchAreas, type AreaHit } from "@mingle/client-core";
import { AppScreen } from "../../src/components/AppScreen";
import { LabeledInput, StateView } from "../../src/components/Foundation";
import { AppMap } from "../../src/components/AppMap";
import { getCurrentCoords } from "../../src/lib/location";
import { savePlaceArea, loadPlaceArea, type PlaceArea } from "../../src/lib/place-area";
import { dark, doodle, space, type as t } from "../../src/lib/theme";
import { serifFont } from "../../src/lib/serif";

/** Nominatim은 초당 1회 권고 — 타이핑마다 때리지 않게 넉넉히 기다린다. */
const DEBOUNCE_MS = 600;

export default function PlaceAreaScreen() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AreaHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [picked, setPicked] = useState<PlaceArea | null>(null);
  const seq = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void loadPlaceArea().then((a) => {
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

  const commit = useCallback(async (area: PlaceArea) => {
    await savePlaceArea(area);
    router.back();
  }, []);

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
    <AppScreen tone="dark" header={{ title: "어디서 만나요?", back: true }}>
      <View style={styles.searchRow}>
        <Search color={dark.textMuted} size={18} strokeWidth={1.75} />
        <View style={styles.searchInput}>
          <LabeledInput
            dark
            label=""
            placeholder="동네·역 이름 (예: 홍대입구역)"
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
        </View>
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
            hitSlop={8}
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
              body="지정한 동네를 기준으로 데이트 맛집을 찾아드려요."
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
              style={({ pressed }) => [styles.hitRow, pressed && styles.pressed]}
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

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  searchInput: { flex: 1 },
  currentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    minHeight: 52,
    marginTop: space.x2,
    paddingHorizontal: space.x4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
  },
  currentText: { flex: 1, ...t.label, color: dark.text },
  pressed: { opacity: 0.7 },
  preview: { gap: space.x3, marginTop: space.x4 },
  previewMap: {
    height: 190,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: doodle.border,
    borderColor: dark.border,
  },
  previewLabel: { ...t.caption, color: dark.textMuted, textAlign: "center" },
  hits: { marginTop: space.x4 },
  hitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: dark.line,
  },
  hitText: { flex: 1, gap: 2 },
  hitLabel: { fontFamily: serifFont, fontSize: 16, color: dark.text },
  hitDetail: { ...t.caption, color: dark.textMuted },
});
