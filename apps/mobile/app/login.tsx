import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { socialLogin, devLogin, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";
import { startSocialOAuth, socialClientAvailable, type SocialProvider } from "../src/lib/social-auth";
import { MasterpieceHero, PillButton } from "../src/components/MasterpieceHero";
import { InlineNotice, LabeledInput } from "../src/components/Foundation";
import { DoodleButton } from "../src/components/Doodle";
import { fonts, masterpiece } from "../src/lib/theme";

const PROVIDERS: { key: SocialProvider; label: string }[] = [
  { key: "kakao", label: "카카오로 시작하기" },
  { key: "naver", label: "네이버로 시작하기" },
  { key: "google", label: "구글로 시작하기" },
];

export default function Login() {
  const insets = useSafeAreaInsets();
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
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <MasterpieceHero
          height={430}
          eyebrow="로테이션 블라인드 소개팅"
          headline={"얼굴보다\n대화가 먼저"}
          subhead="여러 인연을, 편견 없이."
          figure="both"
        />

        <View style={styles.actions}>
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

          {available.length === 0 ? (
            <InlineNotice tone="neutral">
              소셜 로그인이 아직 설정되지 않았어요. EXPO_PUBLIC_*_CLIENT_ID를 설정하거나 아래 dev 로그인을 사용하세요.
            </InlineNotice>
          ) : (
            available.map((p) => (
              <PillButton
                key={p.key}
                title={busy === p.key ? "연결 중…" : p.label}
                onPress={() => (busy === null ? onSocial(p.key) : undefined)}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: masterpiece.cream },
  actions: { paddingHorizontal: 22, paddingTop: 8, gap: 10 },
  devBox: {
    gap: 8,
    marginTop: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: masterpiece.pillGhostBorder,
    borderRadius: 16,
  },
  devLabel: { fontFamily: fonts.bodySemibold, fontSize: 15, color: masterpiece.inkSoft },
});
