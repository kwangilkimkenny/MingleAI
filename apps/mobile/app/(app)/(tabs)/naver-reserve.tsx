/**
 * 데이트 맛집 탭 — 예약 앱(캐치테이블·테이블링) 문법으로 다시 짠 화면(2026-08-06).
 *
 * 기준 위치는 현위치가 아니라 **사용자가 지정한 동네**(`place-area`)다. 상단 위치 바를 누르면
 * 동네를 바꾸고, 그 좌표로 서버가 "동네 + 카테고리"를 검색한다. 카드는 탭하면 상세 시트가
 * 올라오고 거기서 예약(제공사 링크가 있으면 그쪽, 없으면 네이버 장소 페이지)으로 넘어간다.
 * 공개 예약 API가 없어 앱 안에서 예약을 완결할 수는 없다 — 링크가 경계다.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ChevronDown, ChevronRight, MapPin, Navigation, Phone, X } from "lucide-react-native";
import { getNearbyPlaces, type NaverPlace } from "@mingle/client-core";
import { dark, doodle, space, type as t } from "../../../src/lib/theme";
import { serifFont } from "../../../src/lib/serif";
import { StateView } from "../../../src/components/Foundation";
import { DoodleButton } from "../../../src/components/Doodle";
import { AppScreen } from "../../../src/components/AppScreen";
import { AppMap, type MapPlace } from "../../../src/components/AppMap";
import { getCurrentCoords, type Coords } from "../../../src/lib/location";
import { loadPlaceArea, savePlaceArea, type PlaceArea } from "../../../src/lib/place-area";
import {
  categoryLeaf,
  naverMapUrl,
  reservationTarget,
  telUrl,
} from "../../../src/lib/reservation";

/** 데이트 맥락 카테고리 프리셋 — query로 그대로 들어간다. */
const CATEGORIES: { key: string; label: string }[] = [
  { key: "맛집", label: "전체" },
  { key: "레스토랑", label: "레스토랑" },
  { key: "카페", label: "카페" },
  { key: "와인바", label: "와인바" },
  { key: "이자카야", label: "이자카야" },
  { key: "브런치", label: "브런치" },
  { key: "오마카세", label: "오마카세" },
];

/** 카테고리 잎마다 고정 파스텔 — 사진이 없는 목록에 색으로 리듬을 준다. */
const TILE_TINTS = ["#E9D8C3", "#D6E2D0", "#E3D4E4", "#CFDCE8", "#F0D9D5", "#DCD8CB"];

function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 997;
  return TILE_TINTS[h % TILE_TINTS.length];
}

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

type Row = NaverPlace & { km: number | null };

export default function NaverReserve() {
  const [phase, setPhase] = useState<"loading" | "ready" | "unconfigured" | "error">("loading");
  const [rows, setRows] = useState<Row[]>([]);
  const [area, setArea] = useState<PlaceArea | null>(null);
  const [category, setCategory] = useState("맛집");
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const seq = useRef(0);

  /** 기준 좌표: 저장된 지정 위치 → 없으면 현위치를 잡아 지정 위치로 승격. */
  const resolveArea = useCallback(async (): Promise<PlaceArea | null> => {
    const saved = await loadPlaceArea();
    if (saved) return saved;
    const coords = await getCurrentCoords();
    if (!coords) return null;
    const fresh: PlaceArea = { label: "현위치", lat: coords.lat, lng: coords.lng };
    await savePlaceArea(fresh);
    return fresh;
  }, []);

  const fetchPlaces = useCallback(
    async (cat: string, quiet: boolean) => {
      const mySeq = ++seq.current;
      if (!quiet) setPhase("loading");
      try {
        const here = await resolveArea();
        if (mySeq !== seq.current) return;
        setArea(here);
        const res = await getNearbyPlaces(cat, here ? { lat: here.lat, lng: here.lng } : undefined);
        if (mySeq !== seq.current) return;
        const withKm: Row[] = res.places.map((p) => {
          const c = coordsOf(p);
          return { ...p, km: here && c ? distanceKm(here, c) : null };
        });
        withKm.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
        setRows(withKm);
        // 서버가 역지오코딩한 동네 이름이 있으면, 현위치로 잡힌 라벨을 그 이름으로 바꿔 보여준다.
        if (here && here.label === "현위치" && res.area) setArea({ ...here, label: res.area });
        setPhase(res.configured ? "ready" : "unconfigured");
      } catch {
        if (mySeq === seq.current) setPhase("error");
      }
    },
    [resolveArea],
  );

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
    await fetchPlaces(category, true);
    setRefreshing(false);
  }

  // 목록에서 가장 먼 가게까지 담기게 줌을 맞춘다. 지도 카드가 납작해(가로 넓고 세로 150) 반경을
  // 넉넉히 잡아야 위아래 핀이 안 잘린다. 0.6km 하한은 한 건물에 몰렸을 때 과확대 방지.
  const fitKm = useMemo(() => {
    const far = rows.reduce((m, r) => (r.km !== null && r.km > m ? r.km : m), 0);
    return Math.max(0.6, Math.min(far * 1.9, 12));
  }, [rows]);

  const pins = useMemo(
    () =>
      rows
        .map((p) => {
          const c = coordsOf(p);
          return c ? ({ ...c, title: p.title } as MapPlace) : null;
        })
        .filter((p): p is MapPlace => p !== null),
    [rows],
  );

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
        <StateView
          title="맛집을 불러오지 못했어요"
          actionLabel="다시 시도"
          onAction={() => void fetchPlaces(category, false)}
          dark
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen tabScreen tone="dark" body="plain">
      {/* 위치 바 — 어디 기준인지 항상 보이고, 눌러서 바꾼다. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`위치 바꾸기, 현재 ${area?.label ?? "미지정"}`}
        onPress={() => router.push("/(app)/place-area")}
        style={({ pressed }) => [styles.areaBar, pressed && styles.pressed]}
      >
        <MapPin color={dark.accent} size={16} strokeWidth={2} />
        <Text style={styles.areaLabel} numberOfLines={1}>
          {area?.label ?? "위치를 지정해 주세요"}
        </Text>
        <ChevronDown color={dark.textMuted} size={16} strokeWidth={2} />
      </Pressable>

      {area ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지도에서 위치 바꾸기"
          onPress={() => router.push("/(app)/place-area")}
          style={styles.map}
        >
          <AppMap center={{ lat: area.lat, lng: area.lng }} radiusKm={null} fitKm={fitKm} places={pins} />
        </Pressable>
      ) : null}

      {/* 카테고리 — 지도 바로 아래에서 목록을 좁힌다. */}
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
          ListEmptyComponent={
            <StateView title="이 카테고리는 근처에 없어요" body="다른 카테고리나 동네로 찾아보세요." dark />
          }
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          renderItem={({ item }) => <PlaceCard row={item} onOpen={() => setDetail(item)} />}
        />
      )}

      <PlaceSheet row={detail} onClose={() => setDetail(null)} />
    </AppScreen>
  );
}

/** 목록 카드 — 사진이 없는 데이터라 색 타일 + 이니셜로 좌측 앵커를 만든다. */
function PlaceCard({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const target = reservationTarget(row);
  const leaf = categoryLeaf(row.category);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.title} 상세 보기`}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.tile, { backgroundColor: tintFor(row.title) }]}>
          <Text style={styles.tileText}>{row.title.trim().charAt(0)}</Text>
        </View>
        <View style={styles.cardText}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {row.title}
            </Text>
            {target.bookable ? (
              <View style={styles.bookBadge}>
                <Text style={styles.bookBadgeText}>예약</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.leafText}>{leaf}</Text>
            {row.km !== null ? <Text style={styles.dot}>·</Text> : null}
            {row.km !== null ? <Text style={styles.kmText}>{distanceLabel(row.km)}</Text> : null}
          </View>
          <Text style={styles.addr} numberOfLines={1}>
            {row.roadAddress || row.address}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${row.title} ${target.label}`}
          onPress={() => void Linking.openURL(target.url)}
          style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]}
        >
          <Text style={styles.actionPrimaryText}>{target.label}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${row.title} 지도에서 보기`}
          onPress={() => void Linking.openURL(naverMapUrl(row.title))}
          style={({ pressed }) => [styles.actionGhost, pressed && styles.pressed]}
        >
          <Navigation color={dark.text} size={15} strokeWidth={1.75} />
          <Text style={styles.actionGhostText}>지도</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

/** 상세 시트 — 예약 앱처럼 카드를 눌러 올라오는 하단 시트에서 예약 동선을 확정한다. */
function PlaceSheet({ row, onClose }: { row: Row | null; onClose: () => void }) {
  if (!row) return null;
  const target = reservationTarget(row);
  const tel = telUrl(row.telephone);
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetRoot}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="닫기" onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <View style={[styles.tile, { backgroundColor: tintFor(row.title) }]}>
              <Text style={styles.tileText}>{row.title.trim().charAt(0)}</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {row.title}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.leafText}>{categoryLeaf(row.category)}</Text>
                {row.km !== null ? <Text style={styles.dot}>·</Text> : null}
                {row.km !== null ? (
                  <Text style={styles.kmText}>{distanceLabel(row.km)}</Text>
                ) : null}
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={8} onPress={onClose}>
              <X color={dark.textMuted} size={22} strokeWidth={1.75} />
            </Pressable>
          </View>

          <View style={styles.sheetInfo}>
            <MapPin color={dark.textMuted} size={16} strokeWidth={1.75} />
            <Text style={styles.sheetAddr}>{row.roadAddress || row.address}</Text>
          </View>

          <Text style={styles.sheetNote}>
            {target.bookable
              ? `${target.provider}에서 남은 자리를 확인하고 예약해요.`
              : "네이버 장소 페이지에서 예약·전화·길찾기를 할 수 있어요."}
          </Text>

          <View style={styles.sheetDock}>
            <DoodleButton
              title={target.label}
              variant="primary"
              tone="dark"
              onPress={() => void Linking.openURL(target.url)}
            />
            <View style={styles.sheetRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="지도에서 보기"
                onPress={() => void Linking.openURL(naverMapUrl(row.title))}
                style={({ pressed }) => [styles.sheetSecondary, pressed && styles.pressed]}
              >
                <Navigation color={dark.text} size={16} strokeWidth={1.75} />
                <Text style={styles.sheetSecondaryText}>길찾기</Text>
                <ChevronRight color={dark.textMuted} size={16} strokeWidth={1.75} />
              </Pressable>
              {tel ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="전화 걸기"
                  onPress={() => void Linking.openURL(tel)}
                  style={({ pressed }) => [styles.sheetSecondary, pressed && styles.pressed]}
                >
                  <Phone color={dark.text} size={16} strokeWidth={1.75} />
                  <Text style={styles.sheetSecondaryText}>전화</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { flexGrow: 1, paddingBottom: space.x3 },
  gap: { height: space.x2 },
  pressed: { opacity: 0.72 },
  // 위치 바
  areaBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x2,
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingVertical: space.x2,
    paddingHorizontal: space.x3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    marginBottom: space.x2,
  },
  areaLabel: { flexShrink: 1, fontFamily: serifFont, fontSize: 16, color: dark.text },
  map: {
    height: 172,
    marginBottom: space.x3,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: doodle.border,
    borderColor: dark.border,
  },
  // 카테고리
  chipBar: { flexGrow: 0, marginBottom: space.x3 },
  chipRow: { gap: space.x2, paddingVertical: 2 },
  chip: {
    paddingHorizontal: space.x4,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: dark.surface,
    borderWidth: 1,
    // 칩은 테두리로만 식별된다 — 비텍스트 3:1을 만족하는 강한 hairline.
    borderColor: dark.borderStrong,
  },
  chipOn: { backgroundColor: dark.surfaceHi, borderColor: dark.text },
  chipText: { ...t.label, color: dark.textMuted },
  chipTextOn: { color: dark.text },
  // 카드
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 18,
    padding: space.x4,
    gap: space.x3,
  },
  cardTop: { flexDirection: "row", gap: space.x3, alignItems: "center" },
  tile: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tileText: { fontFamily: serifFont, fontSize: 24, color: "#221D18" },
  cardText: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  cardTitle: { flexShrink: 1, fontFamily: serifFont, fontSize: 18, color: dark.text },
  bookBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: dark.accent,
  },
  bookBadgeText: { ...t.caption, fontSize: 11, color: dark.bg },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  leafText: { ...t.caption, color: dark.textMuted },
  dot: { ...t.caption, color: dark.textMuted },
  kmText: { ...t.caption, color: dark.textMuted },
  addr: { ...t.caption, color: dark.textMuted },
  cardActions: { flexDirection: "row", gap: space.x2 },
  actionPrimary: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: dark.text,
  },
  actionPrimaryText: { ...t.label, color: dark.bg },
  actionGhost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: space.x4,
    borderRadius: 12,
    borderWidth: 1,
    // 버튼 윤곽이 유일한 경계 — 강한 hairline.
    borderColor: dark.borderStrong,
  },
  actionGhostText: { ...t.label, color: dark.text },
  // 상세 시트
  sheetRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10,7,5,0.6)" },
  sheet: {
    backgroundColor: dark.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: dark.border,
    padding: space.x5,
    paddingBottom: space.x8,
    gap: space.x4,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: space.x3 },
  sheetTitle: { fontFamily: serifFont, fontSize: 21, color: dark.heading },
  sheetInfo: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  sheetAddr: { flex: 1, ...t.body, color: dark.textMuted },
  sheetNote: { ...t.caption, color: dark.textMuted },
  sheetDock: { gap: space.x2 },
  sheetRow: { flexDirection: "row", gap: space.x2 },
  sheetSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
  },
  sheetSecondaryText: { ...t.label, color: dark.text },
});
