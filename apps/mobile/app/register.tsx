import { colors, doodle, layout, space, type } from "../src/lib/theme";
import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { Check, Eye, EyeOff } from "lucide-react-native";
import { register, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";
import { DoodleButton } from "../src/components/Doodle";
import { DoodleHero } from "../src/components/DoodleHero";
import {
  ContentColumn,
  IconButton,
  InlineNotice,
  LabeledInput,
} from "../src/components/Foundation";

export default function Register() {
  const headerHeight = useHeaderHeight();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { accessToken, refreshToken, role } = await register(email.trim(), password);
      if (!accessToken) {
        throw new Error("서버에서 토큰을 받지 못했습니다.");
      }
      setAuth({ token: accessToken, refreshToken, role });
      router.replace("/home");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "회원가입에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ContentColumn style={styles.container}>
          <DoodleHero tagline="낯가림도 괜찮아요" />
          <View style={styles.intro}>
            <Text accessibilityRole="header" style={styles.title}>안전한 첫 만남을 시작해요</Text>
            <Text style={styles.description}>가입 후 취향을 알려주면 함께 놀기 좋은 파티를 찾아드려요.</Text>
          </View>
          <LabeledInput
            label="이메일"
            placeholder="이메일"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <LabeledInput
            label="비밀번호"
            placeholder="8자 이상 입력"
            autoComplete="new-password"
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={setPassword}
            trailing={
              <IconButton
                label={passwordVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
                onPress={() => setPasswordVisible((visible) => !visible)}
                icon={passwordVisible ? <EyeOff size={20} color={colors.ink} /> : <Eye size={20} color={colors.ink} />}
              />
            }
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: adultConfirmed }}
            onPress={() => setAdultConfirmed((prev) => !prev)}
            style={({ pressed }) => [styles.confirmRow, pressed && styles.pressed]}
          >
            <View style={[styles.checkbox, adultConfirmed && styles.checkboxChecked]}>
              {adultConfirmed ? <Check size={16} color={colors.paper} /> : null}
            </View>
            <View style={styles.confirmText}>
              <Text style={styles.confirmLabel}>만 19세 이상입니다</Text>
              <Text style={styles.confirmHint}>성인 사용자만 가입할 수 있어요.</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: legalAccepted }}
            onPress={() => setLegalAccepted((prev) => !prev)}
            style={({ pressed }) => [styles.confirmRow, pressed && styles.pressed]}
          >
            <View style={[styles.checkbox, legalAccepted && styles.checkboxChecked]}>
              {legalAccepted ? <Check size={16} color={colors.paper} /> : null}
            </View>
            <View style={styles.confirmText}>
              <Text style={styles.confirmLabel}>이용약관과 개인정보 처리 안내에 동의합니다</Text>
              <View style={styles.legalLinks}>
                <Pressable accessibilityRole="link" onPress={() => router.push("/terms")}>
                  <Text style={styles.legalLink}>이용약관</Text>
                </Pressable>
                <Text style={styles.confirmHint}>·</Text>
                <Pressable accessibilityRole="link" onPress={() => router.push("/privacy")}>
                  <Text style={styles.legalLink}>개인정보 처리 안내</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          <DoodleButton
            title={busy ? "가입 중..." : "회원가입"}
            onPress={onSubmit}
            disabled={!adultConfirmed || !legalAccepted || busy || !email.trim() || password.length < 8}
            variant="primary"
          />
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="로그인으로 이동"
            onPress={() => router.push("/login")}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Text style={styles.link}>이미 계정이 있으신가요? <Text style={styles.linkStrong}>로그인</Text></Text>
          </Pressable>
        </ContentColumn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: colors.paper },
  scroll: { flexGrow: 1, justifyContent: "center", padding: layout.screenGutter },
  container: { gap: space.x4, paddingVertical: space.x6 },
  intro: { gap: space.x1 },
  title: { ...type.heading, color: colors.ink, textAlign: "center" },
  description: { ...type.body, color: colors.grayDark, textAlign: "center" },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: space.x3, minHeight: 52 },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    ...doodle.radius.chip,
  },
  checkboxChecked: { backgroundColor: colors.ink },
  confirmText: { flex: 1, gap: 1 },
  confirmLabel: { ...type.label, color: colors.ink },
  confirmHint: { ...type.caption, color: colors.grayDark },
  legalLinks: { flexDirection: "row", alignItems: "center", gap: space.x1, minHeight: 32 },
  legalLink: { ...type.caption, color: colors.ink, textDecorationLine: "underline" },
  linkButton: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  link: { ...type.body, color: colors.grayDark, textAlign: "center" },
  linkStrong: { color: colors.ink, fontFamily: "Pretendard_600SemiBold", textDecorationLine: "underline" },
  pressed: { opacity: 0.65 },
});
