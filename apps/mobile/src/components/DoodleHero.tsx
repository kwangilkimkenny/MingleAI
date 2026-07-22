import { Image, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../lib/theme";
import { EnterHero } from "./Motion";

/**
 * Brand hero for entry/auth screens: the line-art sloth logo (contains the "mingle" wordmark)
 * over a short tagline. The transparent logo asset is tightly cropped and losslessly compressed,
 * so the mark stays sharp without shipping the original 1.3 MB empty canvas.
 * 진입 시 EnterHero(페이드+살짝 확대)로 "스티커 붙는" 등장 — reduced-motion이면 정적.
 */
export function DoodleHero({ tagline = "낯가림도 괜찮아요" }: { tagline?: string }) {
  return (
    <EnterHero>
      <View style={styles.wrap}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="MingleAI"
        />
        <Text style={styles.tagline}>{tagline}</Text>
      </View>
    </EnterHero>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 0 },
  logo: { width: 220, height: 184 },
  tagline: { fontFamily: fonts.displayRegular, fontSize: 18, color: colors.grayDark },
});
