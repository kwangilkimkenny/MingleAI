/**
 * DoodleAvatar — a circular B&W profile picture in the doodle sketchbook style.
 *
 * Shows the photo when `uri` is set, otherwise a fill circle with the name's first
 * grapheme as a Gaegu initial. The ink ring keeps it on-brand whether or not a photo
 * exists. Pure B&W + the shared theme tokens; no color, no new deps.
 */
import { View, Text, Image, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, fonts } from "../lib/theme";
import { initialOf } from "../lib/photo-util";

export function DoodleAvatar({
  uri,
  name,
  size = 48,
  style,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const ring = Math.max(2, Math.round(size * 0.045));
  const frame: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ring,
    borderColor: colors.ink,
    backgroundColor: colors.fill,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <View style={[frame, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          accessibilityLabel={name ? `${name}님의 프로필 사진` : "프로필 사진"}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.42) }]}>
          {initialOf(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  initial: { fontFamily: fonts.display, color: colors.ink, includeFontPadding: false },
});
