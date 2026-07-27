import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import { socialLogin, devLogin, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";
import { primeAccountGate, resolveAccountGate } from "../src/lib/account-gate";
import { startSocialOAuth, socialClientAvailable, type SocialProvider } from "../src/lib/social-auth";
import { LabeledInput } from "../src/components/Foundation";
import { DoodleButton } from "../src/components/Doodle";
import { SocialLoginButton } from "../src/components/SocialLoginButton";
import { dark, fonts } from "../src/lib/theme";

const MAN = require("../assets/images/renaissance-man-cutout.png");
const WOMAN = require("../assets/images/renaissance-woman-cutout.png");

const PROVIDERS: { key: SocialProvider }[] = [
  { key: "kakao" },
  { key: "naver" },
  { key: "google" },
];

export default function Login() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const figW = W * 0.72;
  const manH = figW * (1405 / 1024);
  const womanH = figW * (1400 / 1024);
  const reducedMotion = useReducedMotion();
  const exitProgress = useSharedValue(0);

  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<SocialProvider | "dev" | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [devEmail, setDevEmail] = useState("dev@mingle.test");

  const available = PROVIDERS.filter((p) => socialClientAvailable(p.key));

  const womanExitStyle = useAnimatedStyle(() => {
    const progress = exitProgress.value;
    return {
      opacity: interpolate(progress, [0, 0.72, 1], [1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(progress, [0, 1], [0, -W * 0.9]) },
        { translateY: interpolate(progress, [0, 1], [0, H * 0.04]) },
        { scale: interpolate(progress, [0, 0.7, 1], [1, 0.94, 0.82]) },
      ],
    };
  });

  const manExitStyle = useAnimatedStyle(() => {
    const progress = exitProgress.value;
    return {
      opacity: interpolate(progress, [0, 0.72, 1], [1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(progress, [0, 1], [0, W * 0.9]) },
        { translateY: interpolate(progress, [0, 1], [0, H * 0.38]) },
        { scale: interpolate(progress, [0, 0.7, 1], [1, 0.94, 0.82]) },
      ],
    };
  });

  const contentExitStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exitProgress.value, [0, 0.52], [1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(exitProgress.value, [0, 0.52], [1, 0.98], Extrapolation.CLAMP) },
    ],
  }));

  function playExitAnimation(): Promise<void> {
    if (reducedMotion) return Promise.resolve();
    setTransitioning(true);
    return new Promise((resolve) => {
      exitProgress.value = withTiming(
        1,
        { duration: 1000, easing: Easing.inOut(Easing.cubic) },
        () => runOnJS(resolve)(),
      );
    });
  }

  async function finishLogin({
    accessToken,
    refreshToken,
    role,
  }: {
    accessToken: string;
    refreshToken: string;
    role?: "user" | "admin" | "super_admin";
  }) {
    setAuth({ token: accessToken, refreshToken, role });
    try {
      const gate = await resolveAccountGate();
      if (gate.profileId) {
        setAuth({ token: accessToken, refreshToken, role, profileId: gate.profileId });
      }
      primeAccountGate(gate);
    } catch {
      // The authenticated layout retains its normal loading/error path when preflight fails.
    }
    await playExitAnimation();
    router.replace({ pathname: "/home", params: { entrance: "login" } });
  }

  async function onSocial(provider: SocialProvider) {
    setBusy(provider);
    setError(null);
    try {
      const oauth = await startSocialOAuth(provider);
      if (!oauth) {
        setBusy(null);
        return; // cancelled
      }
      const { accessToken, refreshToken, role } = await socialLogin(
        provider,
        oauth.code,
        oauth.redirectUri,
        oauth.codeVerifier,
      );
      await finishLogin({ accessToken, refreshToken, role });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "로그인에 실패했어요.");
    } finally {
      setBusy(null);
    }
  }

  async function onDevLogin() {
    setBusy("dev");
    setError(null);
    try {
      const { accessToken, refreshToken, role } = await devLogin(devEmail.trim());
      await finishLogin({ accessToken, refreshToken, role });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "dev 로그인 실패(서버 DEV_AUTH_ENABLED 확인).");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.root} pointerEvents={transitioning ? "none" : "auto"}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <Pattern id="login-dots" width={10} height={10} patternUnits="userSpaceOnUse">
            <Circle cx={1.5} cy={1.5} r={1.1} fill="rgba(251,244,236,0.06)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#login-dots)" />
      </Svg>

      {/* woman top-left; man bottom-right and mirrored so the pair faces inward */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.figureLayer,
          { width: figW, height: womanH, left: -18, top: insets.top - 6 },
          womanExitStyle,
        ]}
      >
        <Image source={WOMAN} resizeMode="contain" style={styles.figureImage} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.figureLayer,
          { width: figW, height: manH, right: -18, top: H - insets.bottom - manH + 40 },
          manExitStyle,
        ]}
      >
        <Image
          source={MAN}
          resizeMode="contain"
          style={[styles.figureImage, styles.figureImageFlip]}
        />
      </Animated.View>

      <Animated.ScrollView
        style={contentExitStyle}
        contentContainerStyle={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* brand over the image (not inside the login box) */}
        <View style={styles.brandBlock} pointerEvents="none">
          <Text style={styles.eyebrow}>집에서 시작하는 로테이션 소개팅</Text>
          <Image
            source={require("../assets/images/mingle-mark.png")}
            style={styles.brandMark}
            resizeMode="contain"
            accessibilityLabel="mingle 로고"
          />
          <Text style={styles.brandTagline}>이동 없이, 여러 사람과 가볍게 대화해요</Text>
        </View>

        <View style={styles.card}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {available.length === 0 ? (
            <Text style={styles.notice}>
              소셜 로그인이 아직 설정되지 않았어요. EXPO_PUBLIC_*_CLIENT_ID를 설정하거나 아래 dev 로그인을 사용하세요.
            </Text>
          ) : (
            <View style={styles.pills}>
              {available.map((p) => (
                <SocialLoginButton
                  key={p.key}
                  provider={p.key}
                  busy={busy === p.key}
                  onPress={() => (busy === null ? onSocial(p.key) : undefined)}
                />
              ))}
            </View>
          )}

          {__DEV__ ? (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>개발용 로그인</Text>
              <LabeledInput
                dark
                label="이메일"
                placeholder="dev@mingle.test"
                autoCapitalize="none"
                keyboardType="email-address"
                value={devEmail}
                onChangeText={setDevEmail}
              />
              <DoodleButton
                title={busy === "dev" ? "로그인 중…" : "dev 로그인"}
                onPress={onDevLogin}
                disabled={busy !== null || !devEmail.trim()}
                tone="dark"
              />
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dark.bg },
  figureLayer: { position: "absolute" },
  figureImage: { width: "100%", height: "100%" },
  figureImageFlip: { transform: [{ scaleX: -1 }] },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    gap: 20,
  },
  brandBlock: { alignItems: "center" },
  brandMark: { width: 152, height: 152, marginTop: -36, marginBottom: -36 },
  brandTagline: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: dark.text,
    textAlign: "center",
    textShadowColor: "rgba(10,6,4,0.72)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  eyebrow: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: dark.label,
    textAlign: "center",
    textShadowColor: "rgba(10,6,4,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    gap: 12,
    padding: 22,
    borderRadius: 24,
    backgroundColor: "rgba(36,28,21,0.86)",
    borderWidth: 1,
    borderColor: dark.border,
  },
  error: { fontFamily: fonts.body, fontSize: 13, color: dark.danger, lineHeight: 19 },
  notice: { fontFamily: fonts.body, fontSize: 13, color: dark.textMuted, lineHeight: 20 },
  pills: { gap: 10 },
  pill: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    backgroundColor: dark.pill,
  },
  pillText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: dark.onPill },
  devBox: {
    gap: 8,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: dark.line,
  },
  devLabel: { fontFamily: fonts.bodySemibold, fontSize: 15, color: dark.textMuted },
});
