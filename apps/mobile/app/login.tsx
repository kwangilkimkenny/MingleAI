import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import { socialLogin, devLogin, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";
import { startSocialOAuth, socialClientAvailable, type SocialProvider } from "../src/lib/social-auth";
import { PillButton } from "../src/components/MasterpieceHero";
import { InlineNotice, LabeledInput } from "../src/components/Foundation";
import { DoodleButton } from "../src/components/Doodle";
import { fonts, masterpiece } from "../src/lib/theme";
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
      {/* halftone dot field */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id="login-dots" width={9} height={9} patternUnits="userSpaceOnUse">
            <Circle cx={1.4} cy={1.4} r={1.15} fill={masterpiece.dot} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#login-dots)" opacity={0.5} />
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

      {/* login centered */}
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
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

          {available.length === 0 ? (
            <InlineNotice tone="neutral">
              소셜 로그인이 아직 설정되지 않았어요. EXPO_PUBLIC_*_CLIENT_ID를 설정하거나 아래 dev 로그인을 사용하세요.
            </InlineNotice>
          ) : (
            <View style={styles.pills}>
              {available.map((p) => (
                <PillButton
                  key={p.key}
                  title={busy === p.key ? "연결 중…" : p.label}
                  onPress={() => (busy === null ? onSocial(p.key) : undefined)}
                />
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
  root: { flex: 1, backgroundColor: masterpiece.cream },
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
  card: {
    width: "100%",
    maxWidth: 340,
    gap: 12,
    padding: 22,
    borderRadius: 24,
    backgroundColor: "rgba(244,241,234,0.92)",
    borderWidth: 1,
    borderColor: masterpiece.pillGhostBorder,
    shadowColor: "#221D18",
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  eyebrow: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: "rgba(255,247,240,0.9)",
    textAlign: "center",
    textShadowColor: "rgba(20,12,8,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  brand: {
    fontFamily: serifFont,
    fontSize: 46,
    color: "#FFF7F0",
    textAlign: "center",
    marginTop: 2,
    textShadowColor: "rgba(20,12,8,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
  },
  pills: { gap: 10 },
  devBox: {
    gap: 8,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: masterpiece.pillGhostBorder,
  },
  devLabel: { fontFamily: fonts.bodySemibold, fontSize: 15, color: masterpiece.inkSoft },
});
