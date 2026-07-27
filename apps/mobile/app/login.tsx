import { useCallback, useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
import { socialLogin, devLogin, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";
import { useAuthHydrated } from "../src/lib/use-hydrated";
import { primeAccountGate, resolveAccountGate } from "../src/lib/account-gate";
import { startSocialOAuth, socialClientAvailable, type SocialProvider } from "../src/lib/social-auth";
import { LabeledInput } from "../src/components/Foundation";
import { DoodleButton } from "../src/components/Doodle";
import { LoginBackdrop } from "../src/components/LoginBackdrop";
import { SocialLoginButton } from "../src/components/SocialLoginButton";
import { dark, fonts } from "../src/lib/theme";

const PROVIDERS: { key: SocialProvider }[] = [
  { key: "kakao" },
  { key: "naver" },
  { key: "google" },
];

export default function Login() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const exitProgress = useSharedValue(0);

  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<SocialProvider | "dev" | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [showLoginContent, setShowLoginContent] = useState(false);
  const [devEmail, setDevEmail] = useState("dev@mingle.test");
  const interactiveLogin = useRef(false);
  const autoResumeStarted = useRef(false);

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

  const playExitAnimation = useCallback((): Promise<void> => {
    setTransitioning(true);
    if (reducedMotion) return Promise.resolve();
    return new Promise((resolve) => {
      exitProgress.value = withTiming(
        1,
        { duration: 1000, easing: Easing.inOut(Easing.cubic) },
        () => runOnJS(resolve)(),
      );
    });
  }, [exitProgress, reducedMotion]);

  useEffect(() => {
    if (!hydrated || interactiveLogin.current || autoResumeStarted.current) return;

    if (!token) {
      setShowLoginContent(true);
      return;
    }

    autoResumeStarted.current = true;
    setTransitioning(true);
    const startedAt = Date.now();

    void (async () => {
      try {
        const gate = await resolveAccountGate();
        if (gate.profileId) setAuth({ token, profileId: gate.profileId });
        primeAccountGate(gate);
      } catch {
        // The authenticated layout retains its normal loading/error path when preflight fails.
      }

      // Keep the shared login scene visible long enough to read as an intentional first frame.
      const remaining = Math.max(0, 420 - (Date.now() - startedAt));
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      // A failed refresh may log the user out while the gate is resolving.
      if (!useAuthStore.getState().token) {
        autoResumeStarted.current = false;
        setTransitioning(false);
        setShowLoginContent(true);
        return;
      }

      await playExitAnimation();
      router.replace({ pathname: "/home", params: { entrance: "launch" } });
    })();
  }, [hydrated, playExitAnimation, setAuth, token]);

  async function finishLogin({
    accessToken,
    refreshToken,
    role,
  }: {
    accessToken: string;
    refreshToken: string;
    role?: "user" | "admin" | "super_admin";
  }) {
    interactiveLogin.current = true;
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
      <LoginBackdrop womanStyle={womanExitStyle} manStyle={manExitStyle} />

      {showLoginContent ? (
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dark.bg },
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
