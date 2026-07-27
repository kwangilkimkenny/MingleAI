/**
 * PartyMapArt — shared PARTY_MAP geometry rendered as a warm doodle game board.
 * Every collidable furniture item is visible at the exact geometry used by movement validation,
 * eliminating invisible obstacles. Brown ink, paper, and one blush accent match the character stickers.
 */
import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PARTY_MAP, type DecoDef, type FurnitureDef } from "@mingle/shared";
import { colors, fonts } from "../../lib/theme";

const ROOM_PAPERS = [colors.partyRoom, colors.partyRoomWarm, colors.partyRoomRose] as const;

function Rect({
  item,
  width,
  height,
  children,
  style,
}: {
  item: { x: number; y: number; w: number; h: number };
  width: number;
  height: number;
  children?: ReactNode;
  style?: object;
}) {
  return (
    <View
      style={[
        styles.absolute,
        {
          left: item.x * width,
          top: item.y * height,
          width: item.w * width,
          height: item.h * height,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Furniture({ item, width, height }: { item: FurnitureDef; width: number; height: number }) {
  const base = {
    left: item.x * width,
    top: item.y * height,
    width: item.w * width,
    height: item.h * height,
  };

  if (item.kind === "rug") {
    return (
      <View style={[styles.absolute, base, styles.rug]}>
        {[0, 1, 2, 3].map((row) => (
          <View key={row} style={styles.rugRow}>
            {[0, 1, 2, 3, 4, 5].map((column) => (
              <View
                key={column}
                style={[
                  styles.rugTile,
                  (row + column) % 2 === 0 && styles.rugTileAccent,
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (item.kind === "plant") {
    return (
      <View style={[styles.absolute, base, styles.plant]}>
        <View style={[styles.leaf, styles.leafLeft]} />
        <View style={[styles.leaf, styles.leafCenter]} />
        <View style={[styles.leaf, styles.leafRight]} />
        <View style={styles.pot} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.absolute,
        base,
        styles.furniture,
        item.kind === "table" && styles.table,
        item.kind === "sofa" && styles.sofa,
        item.kind === "stage" && styles.stage,
        item.kind === "bar" && styles.bar,
        item.kind === "dj" && styles.dj,
      ]}
    >
      {item.kind === "sofa" ? <View style={styles.sofaSeat} /> : null}
      {item.kind === "bar" ? (
        <>
          <View style={styles.barLine} />
          <Text style={styles.furnitureLabel}>BAR</Text>
        </>
      ) : null}
      {item.kind === "table" ? <View style={styles.tableCenter} /> : null}
      {item.kind === "stage" ? (
        <>
          <View style={[styles.stageLine, { top: "28%" }]} />
          <View style={[styles.stageLine, { top: "60%" }]} />
        </>
      ) : null}
      {item.kind === "dj" ? (
        <>
          <View style={[styles.disc, { left: "13%" }]} />
          <View style={[styles.disc, { right: "13%" }]} />
          <View style={styles.mixer} />
        </>
      ) : null}
    </View>
  );
}

function Decoration({ item, width, height }: { item: DecoDef; width: number; height: number }) {
  if (item.kind === "stringlights") {
    return (
      <Rect item={item} width={width} height={height} style={styles.lights}>
        {Array.from({ length: 14 }, (_, index) => (
          <View
            key={index}
            style={[
              styles.bulb,
              { left: `${(index / 13) * 96 + 2}%`, top: index % 2 === 0 ? "38%" : "62%" },
            ]}
          />
        ))}
      </Rect>
    );
  }
  if (item.kind === "window") {
    return (
      <Rect item={item} width={width} height={height} style={styles.window}>
        <View style={styles.windowVertical} />
        <View style={styles.windowHorizontal} />
      </Rect>
    );
  }
  if (item.kind === "frame") {
    return <Rect item={item} width={width} height={height} style={styles.frame} />;
  }
  return <Rect item={item} width={width} height={height} style={styles.stain} />;
}

export const PartyMapArt = memo(function PartyMapArt({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  if (width <= 0 || height <= 0) return null;
  const labelSize = Math.min(22, Math.max(13, height * 0.026));

  return (
    <View style={{ width, height, pointerEvents: "none" }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.partyFloor }]} />

      {(PARTY_MAP.rooms ?? []).map((room, index) => (
        <Rect
          key={room.id}
          item={room}
          width={width}
          height={height}
          style={{ backgroundColor: ROOM_PAPERS[index % ROOM_PAPERS.length] }}
        />
      ))}

      {(PARTY_MAP.deco ?? []).map((item) => (
        <Decoration key={item.id} item={item} width={width} height={height} />
      ))}

      {(PARTY_MAP.furniture ?? []).map((item) => (
        <Furniture key={item.id} item={item} width={width} height={height} />
      ))}

      {(PARTY_MAP.walls ?? []).map((wall, index) => (
        <Rect key={index} item={wall} width={width} height={height} style={styles.wall} />
      ))}

      {(PARTY_MAP.rooms ?? []).map((room) => (
        <Text
          key={room.id}
          style={{
            position: "absolute",
            left: room.x * width + Math.max(14, width * 0.014),
            top: room.y * height + Math.max(14, height * 0.018),
            fontFamily: fonts.bodySemibold,
            fontSize: labelSize,
            lineHeight: labelSize * 1.35,
            color: colors.grayDark,
          }}
        >
          {room.name}
        </Text>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  absolute: { position: "absolute" },
  wall: { backgroundColor: colors.ink, borderRadius: 2 },
  furniture: {
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    overflow: "hidden",
  },
  bar: { borderRadius: 8, backgroundColor: colors.partyRoomWarm, justifyContent: "center" },
  barLine: { position: "absolute", left: "8%", right: "8%", top: "28%", height: 2, backgroundColor: colors.ink },
  furnitureLabel: { fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.ink, textAlign: "center" },
  sofa: { borderRadius: 12, backgroundColor: colors.partyRoomRose, padding: 4 },
  sofaSeat: { flex: 1, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 8 },
  table: { borderRadius: 999, alignItems: "center", justifyContent: "center" },
  tableCenter: { width: "42%", height: "42%", borderWidth: 1.5, borderColor: colors.grayDark, borderRadius: 999 },
  stage: { borderRadius: 8, backgroundColor: colors.partyRoomWarm },
  stageLine: { position: "absolute", left: 0, right: 0, height: 1.5, backgroundColor: colors.grayLight },
  dj: { borderRadius: 7, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  disc: { position: "absolute", width: "26%", aspectRatio: 1, borderRadius: 999, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.fill },
  mixer: { width: "18%", height: "58%", borderWidth: 1.5, borderColor: colors.ink, borderRadius: 3 },
  plant: { alignItems: "center", justifyContent: "flex-end" },
  leaf: { position: "absolute", width: "42%", height: "48%", borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, borderRadius: 999 },
  leafLeft: { left: "8%", top: "4%", transform: [{ rotate: "-28deg" }] },
  leafCenter: { left: "29%", top: 0 },
  leafRight: { right: "8%", top: "5%", transform: [{ rotate: "28deg" }] },
  pot: { width: "68%", height: "42%", borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.partyRoomWarm, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  rug: { borderWidth: 2, borderColor: colors.accentDeep, borderRadius: 8, overflow: "hidden", opacity: 0.62 },
  rugRow: { flex: 1, flexDirection: "row" },
  rugTile: { flex: 1, backgroundColor: colors.paper },
  rugTileAccent: { backgroundColor: colors.accentFill },
  lights: { borderTopWidth: 1.5, borderTopColor: colors.ink },
  bulb: { position: "absolute", width: 7, height: 7, marginLeft: -3.5, borderRadius: 4, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.accentFill },
  window: { borderWidth: 2, borderColor: colors.ink, borderRadius: 5, backgroundColor: colors.paper },
  windowVertical: { position: "absolute", left: "49%", top: 0, bottom: 0, width: 1.5, backgroundColor: colors.ink },
  windowHorizontal: { position: "absolute", left: 0, right: 0, top: "49%", height: 1.5, backgroundColor: colors.ink },
  frame: { borderWidth: 2, borderColor: colors.ink, borderRadius: 4, backgroundColor: colors.partyRoomRose, transform: [{ rotate: "-2deg" }] },
  stain: { borderWidth: 1.5, borderColor: colors.grayLight, borderRadius: 999, opacity: 0.45 },
});
