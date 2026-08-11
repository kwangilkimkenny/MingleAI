/**
 * 데이트 맛집 탭 — 캐치테이블·네이버지도·옐프 같은 맛집 탐색 앱의 익숙한 골격을 따른다
 (2026-08-11 캐치테이블 재벤치마크):
 * 조건 바(동네·분류·정렬 요약) → 아이콘 버튼(지도·정렬) + 칩 필터 → 목록 카드 → 상세 시트.
 * 지도는 목록을 밀어내지 않고 아이콘 버튼 뒤 전체화면에 둔다.
 *
 * 없는 정보(사진·평점·가격대·영업시간·예약 가능일)는 만들지 않는다 — 네이버 지역검색이 주지 않는다.
 * 그래서 카드는 이름을 가장 크게 놓고 분류·거리·동네 한 줄, 주소 한 줄, 액션으로 끝난다.
 *
 * 기준 위치는 현위치가 아니라 **사용자가 지정한 동네**(`place-area`)다. 상단 조건 바를 누르면
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
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Map as MapIcon,
  MapPin,
  Navigation,
  Phone,
  X,
} from "lucide-react-native";
import { getNearbyPlaces, type NaverPlace } from "@mingle/client-core";
import { dark, space, type as t } from "../../../src/lib/theme";
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

/** 데이트 맥락 카테고리 프리셋 — 검색 질의로 그대로 들어간다. */
const CATEGORIES: { key: string; label: string }[] = [
  { key: "맛집", label: "전체" },
  { key: "레스토랑", label: "레스토랑" },
  { key: "카페", label: "카페" },
  { key: "와인바", label: "와인바" },
  { key: "이자카야", label: "이자카야" },
  { key: "브런치", label: "브런치" },
  { key: "오마카세", label: "오마카세" },
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

/** "서울특별시 강남구 테헤란로25길 46" → "강남구". 주소 전체는 아래 줄에 따로 있다. */
function districtOf(address: string): string | null {
  const token = address.trim().split(/\s+/)[1];
  return token && /(구|시|군|읍|면)$/.test(token) ? token : null;
}

type Row = NaverPlace & { km: number | null };

export default function NaverReserve() {
  const [phase, setPhase] = useState<
    "loading" | "ready" | "unconfigured" | "error" | "needsArea"
  >("loading");
  const [rows, setRows] = useState<Row[]>([]);
  const [area, setArea] = useState<PlaceArea | null>(null);
  const [category, setCategory] = useState("맛집");
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [bookableOnly, setBookableOnly] = useState(false);
  const [sort, setSort] = useState<"distance" | "recommended">("distance");
  const [mapOpen, setMapOpen] = useState(false);
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
        // 기준 좌표가 없으면 검색하지 않는다 — 좌표 없이 부르면 전국 결과가 섞여 나오고
        // '거리순' 정렬도 기준이 없어 무의미하다(2026-08-11 QA).
        if (!here) {
          setRows([]);
          setPhase("needsArea");
          return;
        }
        const res = await getNearbyPlaces(cat, { lat: here.lat, lng: here.lng });
        if (mySeq !== seq.current) return;
        const withKm: Row[] = res.places.map((p) => {
          const c = coordsOf(p);
          return { ...p, km: here && c ? distanceKm(here, c) : null };
        });
        // 서버가 준 순서 = 네이버 추천/리뷰 정렬. 거리순은 여기서 다시 세운다.
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

  /** 화면에 보일 목록 — 필터(예약 가능만) → 정렬(거리순/추천순). */
  const visible = useMemo(() => {
    const filtered = bookableOnly ? rows.filter((r) => reservationTarget(r).bookable) : rows;
    if (sort === "recommended") return filtered;
    return [...filtered].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  }, [rows, bookableOnly, sort]);

  const categoryLabel = CATEGORIES.find((c) => c.key === category)?.label ?? "전체";

  // 가장 먼 가게까지 담기게 줌을 맞춘다. 지도가 전체화면(세로로 길다)이 되면서 여유를 1.9→1.3배로
  // 줄였다 — 그대로 두면 한강까지 나와 핀이 좁쌀이 된다. 0.6km 하한은 한 건물에 몰렸을 때 과확대 방지.
  const fitKm = useMemo(() => {
    const far = rows.reduce((m, r) => (r.km !== null && r.km > m ? r.km : m), 0);
    return Math.max(0.6, Math.min(far * 1.3, 12));
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
      <AppScreen
        tabScreen
        tone="dark"
        body="plain"
      >
        <StateView title="준비 중이에요" body="곧 근처 맛집을 지도에서 찾고 바로 예약할 수 있게 돼요." dark />
      </AppScreen>
    );
  }
  if (phase === "needsArea") {
    return (
      <AppScreen
        tabScreen
        tone="dark"
        body="plain"
      >
        <StateView
          title="어디서 만날까요?"
          body="동네를 고르면 그 근처 맛집만 보여드려요."
          actionLabel="동네 고르기"
          onAction={() => router.push("/(app)/place-area")}
          dark
        />
      </AppScreen>
    );
  }
  if (phase === "error") {
    return (
      <AppScreen
        tabScreen
        tone="dark"
        body="plain"
      >
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
    <AppScreen
      tabScreen
      tone="dark"
      body="plain"
    >
      {/* 조건 바 — 지금 무엇을 기준으로 보고 있는지 한 줄로 요약한다(캐치테이블의 "날짜·인원·시간"
          자리). 누르면 동네를 바꾼다. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`동네 바꾸기, 현재 ${area?.label ?? "미지정"}`}
        onPress={() => router.push("/(app)/place-area")}
        style={({ pressed }) => [styles.conditionBar, pressed && styles.pressed]}
      >
        <MapPin color={dark.accent} size={17} strokeWidth={2} />
        <Text style={styles.conditionText} numberOfLines={1}>
          {[area?.label ?? "동네", categoryLabel, sort === "distance" ? "거리순" : "추천순"].join(
            "  ·  ",
          )}
        </Text>
        <ChevronDown color={dark.textMuted} size={18} strokeWidth={2} />
      </Pressable>

      {/* 도구 행 — 지도·정렬은 아이콘 버튼, 나머지는 칩. 지도는 목록을 밀어내지 않고 버튼 뒤에 둔다. */}
      <View style={styles.filterRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지도로 보기"
          onPress={() => setMapOpen(true)}
          disabled={!area}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, !area && styles.disabled]}
        >
          <MapIcon color={dark.text} size={19} strokeWidth={1.75} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: sort === "distance" }}
          accessibilityLabel={
            sort === "distance" ? "거리순 정렬, 눌러서 추천순" : "추천순 정렬, 눌러서 거리순"
          }
          onPress={() => setSort((v) => (v === "distance" ? "recommended" : "distance"))}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <ArrowUpDown color={dark.text} size={18} strokeWidth={1.75} />
        </Pressable>
        <View style={styles.divider} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipBar}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: bookableOnly }}
            accessibilityLabel="예약 가능한 곳만 보기"
            onPress={() => setBookableOnly((v) => !v)}
            style={[styles.chip, bookableOnly && styles.chipGold]}
          >
            <Text style={[styles.chipText, bookableOnly && styles.chipGoldText]}>예약 가능만</Text>
          </Pressable>
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
      </View>

      <Text style={styles.resultCount}>{visible.length}곳</Text>

      {phase === "loading" ? (
        <View style={styles.flex}>
          <StateView title="주변을 둘러보고 있어요" loading dark />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(p, i) => `${p.title}-${i}`}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dark.text} />
          }
          ListEmptyComponent={
            <StateView
              title={bookableOnly ? "예약 가능한 곳이 없어요" : "근처에 결과가 없어요"}
              body={bookableOnly ? "필터를 끄면 더 많은 곳을 볼 수 있어요." : "다른 카테고리나 동네로 찾아보세요."}
              dark
            />
          }
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          renderItem={({ item }) => <PlaceCard row={item} onOpen={() => setDetail(item)} />}
        />
      )}

      <PlaceSheet row={detail} onClose={() => setDetail(null)} />

      {/* 지도 크게 보기 — 목록과 지도를 오가는 건 맛집 앱의 기본 동선이다. */}
      <Modal
        visible={mapOpen && !!area}
        animationType="slide"
        onRequestClose={() => setMapOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.fullMap}>
          {area ? (
            <AppMap center={{ lat: area.lat, lng: area.lng }} radiusKm={null} fitKm={fitKm} places={pins} />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="지도 닫기"
            onPress={() => setMapOpen(false)}
            style={styles.fullMapClose}
          >
            <X color={dark.onPill} size={20} strokeWidth={2} />
          </Pressable>
        </View>
      </Modal>
    </AppScreen>
  );
}

/**
 * 목록 카드 — 이름이 가장 먼저 오고 그 아래 한 줄로 분류·거리·동네, 그다음 주소, 마지막이 액션.
 * 사진·평점·가격·영업시간은 네이버 지역검색이 주지 않는다 — 자리를 비워두지도, 지어내지도 않는다.
 */
function PlaceCard({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const target = reservationTarget(row);
  const leaf = categoryLeaf(row.category);
  const district = districtOf(row.address || row.roadAddress);
  const meta = [leaf, row.km !== null ? distanceLabel(row.km) : null, district].filter(Boolean);
  // 카드 전체를 Pressable로 감싸면 예약·지도 버튼이 그 안에 중첩된다(웹에선 <button> 안의
  // <button>, 네이티브에선 히트박스 중첩). 상단 정보 영역만 눌리게 하고 액션은 형제로 둔다.
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${row.title} 상세 보기`}
        onPress={onOpen}
        style={({ pressed }) => [styles.cardTop, pressed && styles.pressed]}
      >
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {row.title}
          </Text>
          {target.bookable ? (
            <View style={styles.bookBadge}>
              <Text style={styles.bookBadgeText}>예약</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.metaLine} numberOfLines={1}>
          {meta.join("  ·  ")}
        </Text>
        <Text style={styles.addr} numberOfLines={1}>
          {row.roadAddress || row.address}
        </Text>
      </Pressable>

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
    </View>
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
            <View style={styles.sheetHeadText}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {row.title}
              </Text>
              <Text style={styles.metaLine} numberOfLines={1}>
                {[
                  categoryLeaf(row.category),
                  row.km !== null ? distanceLabel(row.km) : null,
                  districtOf(row.address || row.roadAddress),
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
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
  // 도구 행 — 아이콘 버튼(지도·정렬) | 칩 스크롤
  filterRow: { flexDirection: "row", alignItems: "center", gap: space.x2, marginBottom: space.x2 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: dark.borderStrong,
  },
  disabled: { opacity: 0.4 },
  divider: { width: 1, height: 22, backgroundColor: dark.border },
  resultCount: { ...t.caption, color: dark.textMuted, marginBottom: space.x2 },
  fullMap: { flex: 1, backgroundColor: dark.bg },
  fullMapClose: {
    position: "absolute",
    top: 48,
    right: space.x4,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: dark.pill,
  },
  // 조건 바 — 화면 맨 위에서 지금 기준을 한 줄로 요약한다.
  conditionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x2,
    minHeight: 48,
    paddingHorizontal: space.x3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    marginBottom: space.x2,
  },
  conditionText: { flex: 1, fontFamily: serifFont, fontSize: 16, color: dark.text },
  // 카테고리
  chipBar: { flexGrow: 0 },
  chipRow: { gap: space.x2, paddingVertical: 2, paddingRight: space.x4 },
  chip: {
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: space.x4,
    borderRadius: 999,
    backgroundColor: dark.surface,
    borderWidth: 1,
    // 칩은 테두리로만 식별된다 — 비텍스트 3:1을 만족하는 강한 hairline.
    borderColor: dark.borderStrong,
  },
  chipOn: { backgroundColor: dark.surfaceHi, borderColor: dark.text },
  chipText: { ...t.label, color: dark.textMuted },
  chipTextOn: { color: dark.text },
  chipGold: { backgroundColor: dark.goldFill, borderColor: dark.gold },
  chipGoldText: { color: dark.gold },
  // 카드
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 18,
    padding: space.x4,
    gap: space.x3,
  },
  cardTop: { gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  cardTitle: { flexShrink: 1, fontFamily: serifFont, fontSize: 21, lineHeight: 27, color: dark.text },
  // "예약 가능"은 상태다 — 브랜드 강조(블러시)와 색을 나눠 신호가 되게 한다.
  bookBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: dark.gold,
  },
  bookBadgeText: { ...t.caption, fontSize: 11, color: dark.onGold },
  metaLine: { ...t.caption, color: dark.text },
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
  sheetRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: dark.scrim },
  sheet: {
    backgroundColor: dark.surfaceTop,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: dark.border,
    padding: space.x5,
    paddingBottom: space.x8,
    gap: space.x4,
  },
  sheetHead: { flexDirection: "row", alignItems: "flex-start", gap: space.x3 },
  sheetHeadText: { flex: 1, gap: 4 },
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
