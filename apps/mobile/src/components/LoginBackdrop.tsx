import { Image, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { brandPalette, dark } from "../lib/theme";

const MAN = require("../../assets/images/renaissance-man-cutout.png");
const WOMAN = require("../../assets/images/renaissance-woman-cutout.png");

type LoginBackdropProps = {
  womanStyle?: object;
  manStyle?: object;
};

/**
 * The shared first frame for both a fresh login and a restored session.
 * Keeping it outside the login controls prevents persisted users from seeing a login flash.
 */
export function LoginBackdrop({ womanStyle, manStyle }: LoginBackdropProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const figureWidth = width * 0.72;
  const manHeight = figureWidth * (1405 / 1024);
  const womanHeight = figureWidth * (1400 / 1024);

  return (
    <>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="login-base" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={dark.bg} />
            <Stop offset="0.52" stopColor={brandPalette.brown900} />
            <Stop offset="1" stopColor={brandPalette.brown850} />
          </LinearGradient>
          <RadialGradient id="login-blush-top" cx="0.08" cy="0.08" rx="0.88" ry="0.6">
            <Stop offset="0" stopColor={brandPalette.blush500} stopOpacity={0.34} />
            <Stop offset="0.42" stopColor={brandPalette.blush700} stopOpacity={0.12} />
            <Stop offset="1" stopColor={brandPalette.blush800} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="login-blush-bottom" cx="0.92" cy="0.96" rx="0.82" ry="0.58">
            <Stop offset="0" stopColor={brandPalette.blush300} stopOpacity={0.25} />
            <Stop offset="0.48" stopColor={brandPalette.blush700} stopOpacity={0.1} />
            <Stop offset="1" stopColor={brandPalette.blush800} stopOpacity={0} />
          </RadialGradient>
          <Pattern id="login-speckles" width={32} height={32} patternUnits="userSpaceOnUse">
            <Circle cx={5} cy={6} r={1.25} fill={brandPalette.blush200} opacity={0.18} />
            <Circle cx={23} cy={22} r={0.65} fill={brandPalette.blush50} opacity={0.1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#login-base)" />
        <Rect width="100%" height="100%" fill="url(#login-blush-top)" />
        <Rect width="100%" height="100%" fill="url(#login-blush-bottom)" />
        <Ellipse
          cx={width * 0.08}
          cy={height * 0.28}
          rx={width * 0.62}
          ry={height * 0.22}
          fill="none"
          stroke={brandPalette.blush300}
          strokeWidth={1}
          opacity={0.11}
          transform={`rotate(-18 ${width * 0.08} ${height * 0.28})`}
        />
        <Ellipse
          cx={width * 0.9}
          cy={height * 0.76}
          rx={width * 0.56}
          ry={height * 0.2}
          fill="none"
          stroke={brandPalette.blush200}
          strokeWidth={1}
          opacity={0.09}
          transform={`rotate(-18 ${width * 0.9} ${height * 0.76})`}
        />
        <Rect width="100%" height="100%" fill="url(#login-speckles)" />
      </Svg>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.figureLayer,
          { width: figureWidth, height: womanHeight, left: -18, top: insets.top - 6 },
          womanStyle,
        ]}
      >
        <Image source={WOMAN} resizeMode="contain" style={styles.figureImage} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.figureLayer,
          {
            width: figureWidth,
            height: manHeight,
            right: -18,
            top: height - insets.bottom - manHeight + 40,
          },
          manStyle,
        ]}
      >
        <Image
          source={MAN}
          resizeMode="contain"
          style={[styles.figureImage, styles.figureImageFlip]}
        />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  figureLayer: { position: "absolute" },
  figureImage: { width: "100%", height: "100%" },
  figureImageFlip: { transform: [{ scaleX: -1 }] },
});
