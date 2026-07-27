import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fonts } from "../lib/theme";
import type { SocialProvider } from "../lib/social-auth";

/**
 * 소셜 로그인 브랜드 버튼 — 각 제공자의 시그니처 컬러 박스 + 공식 로고 + 짧은 이름.
 * 브랜드 가이드: 카카오 #FEE500/검정 말풍선, 네이버 #03C75A/흰 N, 구글 흰 배경/4색 G(+헤어라인).
 */
const BRAND: Record<
  SocialProvider,
  { bg: string; text: string; label: string; border?: string }
> = {
  kakao: { bg: "#FEE500", text: "rgba(0,0,0,0.85)", label: "카카오" },
  naver: { bg: "#03C75A", text: "#FFFFFF", label: "네이버" },
  google: { bg: "#FFFFFF", text: "#1F1F1F", label: "구글", border: "#DADCE0" },
};

function KakaoLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#191919"
        d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.86 5.33 4.64 6.74-.2.75-.73 2.71-.84 3.13-.13.52.19.51.4.37.17-.11 2.65-1.8 3.72-2.53.67.1 1.37.15 2.08.15 5.52 0 10-3.58 10-8s-4.48-8-10-8z"
      />
    </Svg>
  );
}

function NaverLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path fill="#FFFFFF" d="M13.04 10.7 6.9 2.5H2.5v15h4.46V9.3l6.14 8.2h4.4v-15h-4.46v8.2z" />
    </Svg>
  );
}

function GoogleLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </Svg>
  );
}

const LOGO: Record<SocialProvider, (props: { size: number }) => React.JSX.Element> = {
  kakao: KakaoLogo,
  naver: NaverLogo,
  google: GoogleLogo,
};

export function SocialLoginButton({
  provider,
  busy = false,
  onPress,
}: {
  provider: SocialProvider;
  busy?: boolean;
  onPress: () => void;
}) {
  const brand = BRAND[provider];
  const Logo = LOGO[provider];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${brand.label}로 로그인`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: brand.bg },
        brand.border ? { borderWidth: StyleSheet.hairlineWidth, borderColor: brand.border } : null,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.inner}>
        <Logo size={20} />
        <Text style={[styles.label, { color: brand.text }]}>
          {busy ? "연결 중…" : brand.label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 16, lineHeight: 22 },
});
