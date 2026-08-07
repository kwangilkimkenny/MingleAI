/**
 * DoodleAvatar — a circular profile picture in the soft dating style.
 *
 * Shows the photo when `uri` is set, otherwise a rose fill circle with the name's first
 * grapheme. A soft rose hairline ring keeps it on-brand whether or not a photo exists.
 * Uses the shared theme tokens; no new deps.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, View, Text, Image, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, dark as darkTokens, fonts } from "../lib/theme";
import { initialOf } from "../lib/photo-util";

export function DoodleAvatar({
  uri,
  name,
  size = 48,
  style,
  dark = false,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** 다크 화면(채팅 목록 등)용 — 원과 이니셜을 함께 뒤집는다. 배경만 어둡게 덮으면
   *  이니셜이 잉크색 그대로 남아 안 보인다(대비 1.06:1, QA 2026-08-06). */
  dark?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoading(Boolean(uri));
  }, [uri]);

  const ring = Math.max(2, Math.round(size * 0.045));
  const frame: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ring,
    borderColor: dark ? darkTokens.border : colors.border,
    backgroundColor: dark ? darkTokens.surfaceHi : colors.fill,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <View style={[frame, style]}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
          accessibilityLabel={name ? `${name}님의 프로필 사진` : "프로필 사진"}
        />
      ) : (
        <Text
          style={[
            styles.initial,
            { fontSize: Math.round(size * 0.42) },
            dark && { color: darkTokens.text },
          ]}
        >
          {initialOf(name)}
        </Text>
      )}
      {loading ? (
        <View
          pointerEvents="none"
          style={[styles.loading, dark && { backgroundColor: darkTokens.surfaceHi }]}
        >
          <ActivityIndicator size="small" color={colors.grayDark} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  initial: { fontFamily: fonts.display, color: colors.ink, includeFontPadding: false },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fill,
  },
});
