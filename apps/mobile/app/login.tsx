import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import { socialLogin, devLogin, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";
import { startSocialOAuth, socialClientAvailable, type SocialProvider } from "../src/lib/social-auth";
import { LabeledInput } from "../src/components/Foundation";
import { DoodleButton } from "../src/components/Doodle";
import { dark, fonts } from "../src/lib/theme";
import { serifFont } from "../src/lib/serif";

const MAN = require("../assets/images/renaissance-man-cutout.png");
const WOMAN = require("../assets/images/renaissance-woman-cutout.png");

const PROVIDERS: { key: SocialProvider; label: string }[] = [
  { key: "kakao", label: "카카오로 시작하기" },
  { key: "naver", label: "네이버로 시작하기" },
  { key: "google", label: "구글로 시작하기" },
];

export default function Login() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const figW = W * 0.72;
  const manH = figW * (1405 / 1024);
  const womanH = figW * (1400 / 1024);

  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<SocialProvider | "dev" | null>(null);
  const [devEmail, setDevEmail] = useState("dev@mingle.test");

  const available = PROVIDERS.filter((p) => socialClientAvailable(p.key));

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
      setAuth({ token: accessToken, refreshToken, role });
      router.replace("/home");
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
      setAuth({ token: accessToken, refreshToken, role });
      router.replace("/home");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "dev 로그인 실패(서버 DEV_AUTH_ENABLED 확인).");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.root}>
      {/* subtle light halftone on the dark ground */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id="login-dots" width={10} height={10} patternUnits="userSpaceOnUse">
            <Circle cx={1.5} cy={1.5} r={1.1} fill="rgba(251,244,236,0.06)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#login-dots)" />
      </Svg>

      {/* man top-left, woman bottom-right (mirrored) — same composition as home */}
      <Image
        source={MAN}
        resizeMode="contain"
        style={[styles.fig, { width: figW, height: manH, left: -18, top: insets.top - 6 }]}
      />
      <Image
        source={WOMAN}
        resizeMode="contain"
        style={[
          styles.figFlip,
          { width: figW, height: womanH, right: -18, top: H - insets.bottom - womanH + 40 },
        ]}
      />

      <ScrollView
        contentContainerStyle={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* brand over the image (not inside the login box) */}
        <View style={styles.brandBlock} pointerEvents="none">
          <Text style={styles.eyebrow}>로테이션 블라인드 소개팅</Text>
          <Text style={styles.brand}>mingle</Text>
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
                <Pressable
                  key={p.key}
                  accessibilityRole="button"
                  accessibilityLabel={p.label}
                  onPress={() => (busy === null ? onSocial(p.key) : undefined)}
                  style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.pillText}>{busy === p.key ? "연결 중…" : p.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {__DEV__ ? (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>개발용 로그인</Text>
              <LabeledInput
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
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dark.bg },
  fig: { position: "absolute" },
  figFlip: { position: "absolute", transform: [{ scaleX: -1 }] },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    gap: 20,
  },
  brandBlock: { alignItems: "center" },
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
  brand: {
    fontFamily: serifFont,
    fontSize: 46,
    color: dark.text,
    textAlign: "center",
    marginTop: 2,
    textShadowColor: "rgba(10,6,4,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
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
