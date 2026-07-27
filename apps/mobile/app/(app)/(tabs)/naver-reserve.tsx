import { useCallback, useState } from "react";
import { View, FlatList, Linking, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { MapPin } from "lucide-react-native";
import { getNearbyPlaces, type NaverPlace } from "@mingle/client-core";
import { dark, doodle, space } from "../../../src/lib/theme";
import { StateView } from "../../../src/components/Foundation";
import { AppScreen } from "../../../src/components/AppScreen";
import { ListRow, RowSeparator } from "../../../src/components/ListRow";
import { AppMap, type MapPlace } from "../../../src/components/AppMap";
import { getCurrentCoords, type Coords } from "../../../src/lib/location";


/** Naver local-search mapx/mapy are WGS84 ×1e7 strings → decimal degrees for map pins. */
function toMapPlace(p: NaverPlace): MapPlace | null {
  const lat = Number(p.mapy) / 1e7;
  const lng = Number(p.mapx) / 1e7;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng, title: p.title };
}

export default function NaverReserve() {
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

  if (phase === "loading") {
    return (
      <AppScreen tabScreen tone="dark" body="plain">
        <StateView title="맛집을 불러오고 있어요" loading dark />
      </AppScreen>
    );
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
        <StateView title="맛집을 불러오지 못했어요" actionLabel="다시 시도" onAction={load} dark />
      </AppScreen>
    );
  }

  const pins = places.map(toMapPlace).filter((p): p is MapPlace => p !== null);

  return (
    <AppScreen tabScreen tone="dark" body="plain">
      {center ? (
        <View style={styles.map}>
          <AppMap center={center} radiusKm={null} places={pins} />
        </View>
      ) : null}
      <FlatList
        data={places}
        keyExtractor={(p, i) => `${p.title}-${i}`}
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <RowSeparator gutter={0} dark />}
        ListEmptyComponent={<StateView title="근처 맛집이 없어요" dark />}
        renderItem={({ item }) => (
          <ListRow
            gutter={0}
            dark
            leading={<MapPin color={dark.accent} size={20} strokeWidth={1.75} />}
            title={item.title}
            subtitle={
              [item.category, item.roadAddress || item.address].filter(Boolean).join(" · ") ||
              undefined
            }
            accessibilityLabel={`${item.title}, 네이버에서 보기`}
            onPress={() => item.link && Linking.openURL(item.link)}
          />
        )}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { flexGrow: 1 },
  map: {
    height: 200,
    marginBottom: space.x3,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: doodle.border,
    borderColor: dark.border,
  },
});
