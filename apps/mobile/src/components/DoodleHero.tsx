import { Image, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../lib/theme";

/**
 * Brand hero for entry/auth screens: the line-art sloth logo (contains the "mingle" wordmark)
 * over a short tagline. The logo PNG has a white ground, which disappears into colors.paper.
 */
export function DoodleHero({ tagline = "낯가림도 괜찮아요" }: { tagline?: string }) {
  return (
    <View style={styles.wrap}>
      <Image
        source={require("../../assets/images/logo.png")}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="MingleAI"
      />
      <Text style={styles.tagline}>{tagline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 0 },
  // Source art is 1024² with generous margins — a square box crops dead space via the negative margin.
  logo: { width: 220, height: 190, marginVertical: -10 },
  tagline: { fontFamily: fonts.displayRegular, fontSize: 18, color: colors.grayDark },
});
