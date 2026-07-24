import { colors, space, type } from "../src/lib/theme";
import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { socialLogin, devLogin, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";
import { startSocialOAuth, socialClientAvailable, type SocialProvider } from "../src/lib/social-auth";
import { AppScreen } from "../src/components/AppScreen";
import { DoodleButton } from "../src/components/Doodle";
import { DoodleHero } from "../src/components/DoodleHero";
import { InlineNotice, LabeledInput } from "../src/components/Foundation";

const PROVIDERS: { key: SocialProvider; label: string }[] = [
  { key: "kakao", label: "카카오로 시작하기" },
  { key: "naver", label: "네이버로 시작하기" },
  { key: "google", label: "구글로 시작하기" },
];

export default function Login() {
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
    <AppScreen body="scroll" contentStyle={styles.scroll}>
      <View style={styles.container}>
        <DoodleHero tagline="가벼운 만남의 시작" />
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.title}>소셜 계정으로 시작하세요</Text>
          <Text style={styles.description}>
            안전한 만남을 위해 소셜 로그인 후 본인인증을 진행해요. 별도 비밀번호는 없어요.
          </Text>
        </View>

        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

        {available.length === 0 ? (
          <InlineNotice tone="neutral">
            소셜 로그인이 아직 설정되지 않았어요. EXPO_PUBLIC_*_CLIENT_ID를 설정하거나 아래 dev 로그인을 사용하세요.
          </InlineNotice>
        ) : (
          available.map((p) => (
            <DoodleButton
              key={p.key}
              title={busy === p.key ? "연결 중…" : p.label}
              onPress={() => onSocial(p.key)}
              disabled={busy !== null}
              variant="primary"
            />
          ))
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
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  // AppScreen owns SafeArea + paper background + width cap; this only centers the branding column.
  scroll: { flexGrow: 1, justifyContent: "center" },
  container: { gap: space.x4, paddingVertical: space.x6 },
  intro: { gap: space.x1 },
  title: { ...type.heading, color: colors.ink, textAlign: "center" },
  description: { ...type.body, color: colors.grayDark, textAlign: "center" },
  devBox: {
    gap: space.x2,
    marginTop: space.x6,
    padding: space.x4,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
  },
  devLabel: { ...type.label, color: colors.grayDark },
});
