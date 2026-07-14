import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { DoodleFace } from "./DoodleSvg";
import { colors, fonts } from "../lib/theme";

export function DoodleHero({ tagline = "낯가림도 괜찮아요" }: { tagline?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.mark}>
        Mingle<Text style={styles.markAi}>AI</Text>
      </Text>
      <Text style={styles.tagline}>{tagline}</Text>
      <View style={styles.faces}>
        <DoodleFace size={60} seed={4} />
        <Svg width={52} height={38} viewBox="0 0 56 40">
          <Path
            d="M4 20 C14 8 22 32 30 20 C36 11 44 11 50 20"
            fill="none"
            stroke={colors.ink}
            strokeWidth={2.2}
            strokeDasharray="1 6"
            strokeLinecap="round"
          />
          <Path d="M50 20 C46 14 40 15 41 21 C42 26 49 26 50 20 Z" fill={colors.ink} />
        </Svg>
        <DoodleFace size={60} seed={8} inverted />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 4 },
  mark: { fontFamily: fonts.display, fontSize: 46, color: colors.ink, lineHeight: 52 },
  markAi: { color: colors.accent, fontSize: 28 },
  tagline: { fontFamily: fonts.displayRegular, fontSize: 18, color: colors.grayDark },
  faces: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
});
