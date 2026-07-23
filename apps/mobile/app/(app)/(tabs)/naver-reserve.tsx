import { useCallback, useState, type ReactNode } from "react";
import { View, Text, FlatList, Pressable, Linking, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { getNearbyPlaces, type NaverPlace } from "@mingle/client-core";
import { colors, doodle, layout, space, type } from "../../../src/lib/theme";
import { ContentColumn, PageHeader, StateView } from "../../../src/components/Foundation";
import { DashedLine } from "../../../src/components/DoodleSvg";
import { NaverMap, type MapPlace } from "../../../src/components/NaverMap";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { getCurrentCoords, type Coords } from "../../../src/lib/location";

/** Naver local-search mapx/mapy are WGS84 ×1e7 strings → decimal degrees for map pins. */
function toMapPlace(p: NaverPlace): MapPlace | null {
  const lat = Number(p.mapy) / 1e7;
  const lng = Number(p.mapx) / 1e7;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng, title: p.title };
}

export default function NaverReserve() {
  const clearance = useTabBarClearance();
  const [phase, setPhase] = useState<"loading" | "ready" | "unconfigured" | "error">("loading");
  const [places, setPlaces] = useState<NaverPlace[]>([]);
  const [center, setCenter] = useState<Coords | null>(null);

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    void getCurrentCoords().then((c) => {
      if (alive && c) setCenter(c);
    });
    getNearbyPlaces()
      .then((res) => {
        if (!alive) return;
        setPlaces(res.places);
        setPhase(res.configured ? "ready" : "unconfigured");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(load);

  if (phase === "loading") return <StateView title="맛집을 불러오고 있어요" loading />;
  if (phase === "unconfigured") {
    return (
      <Screen>
        <StateView title="곧 만나요" body="근처 맛집을 지도에서 찾고 바로 예약할 수 있어요." />
      </Screen>
    );
  }
  if (phase === "error") {
    return (
      <Screen>
        <StateView title="맛집을 불러오지 못했어요" actionLabel="다시 시도" onAction={load} />
      </Screen>
    );
  }

  const pins = places.map(toMapPlace).filter((p): p is MapPlace => p !== null);

  return (
    <Screen>
      {center ? (
        <View style={styles.map}>
          <NaverMap center={center} radiusKm={null} places={pins} />
        </View>
      ) : null}
      <FlatList
        data={places}
        keyExtractor={(p, i) => `${p.title}-${i}`}
        contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
        ItemSeparatorComponent={() => <DashedLine />}
        ListEmptyComponent={<StateView title="근처 맛집이 없어요" />}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={() => item.link && Linking.openURL(item.link)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, 네이버에서 보기`}
          >
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[item.category, item.roadAddress || item.address].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <ChevronRight color={colors.grayMid} size={20} strokeWidth={2} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.container}>
      <ContentColumn style={styles.header}>
        <PageHeader title="네이버 예약" />
      </ContentColumn>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: layout.screenGutter },
  map: {
    height: 200,
    marginHorizontal: layout.screenGutter,
    marginBottom: space.x3,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: doodle.border,
    borderColor: colors.border,
  },
  list: { width: "100%", maxWidth: layout.contentMax, alignSelf: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    minHeight: 64,
    paddingVertical: space.x3,
    paddingHorizontal: layout.screenGutter,
  },
  rowText: { flex: 1, gap: 2 },
  name: { ...type.heading, fontSize: 17, lineHeight: 22, color: colors.ink },
  meta: { ...type.caption, color: colors.grayDark },
});
