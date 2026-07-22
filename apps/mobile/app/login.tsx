import { colors, layout, space, type } from "../src/lib/theme";
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
import { login, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";
import { DoodleButton } from "../src/components/Doodle";
import { DoodleHero } from "../src/components/DoodleHero";
import { Eye, EyeOff } from "lucide-react-native";
import {
  ContentColumn,
  IconButton,
  InlineNotice,
  LabeledInput,
} from "../src/components/Foundation";

export default function Login() {
  const headerHeight = useHeaderHeight();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { accessToken, refreshToken, role } = await login(email.trim(), password);
      if (!accessToken) {
        throw new Error("서버에서 토큰을 받지 못했습니다.");
      }
      setAuth({ token: accessToken, refreshToken, role });
      router.replace("/home");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "로그인에 실패했습니다.");
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
          <DoodleHero tagline="다시 만나서 반가워요" />
          <View style={styles.intro}>
            <Text accessibilityRole="header" style={styles.title}>다시 이어갈 준비가 됐나요?</Text>
            <Text style={styles.description}>게임에서 만난 인연과 대화를 계속해 보세요.</Text>
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
            placeholder="비밀번호"
            autoComplete="current-password"
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
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          <DoodleButton
            title={busy ? "로그인 중..." : "로그인"}
            onPress={onSubmit}
            disabled={busy || !email.trim() || !password}
            variant="primary"
          />
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="회원가입으로 이동"
            onPress={() => router.push("/register")}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Text style={styles.link}>계정이 없으신가요? <Text style={styles.linkStrong}>회원가입</Text></Text>
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
  linkButton: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  link: { ...type.body, color: colors.grayDark, textAlign: "center" },
  linkStrong: { color: colors.ink, fontFamily: "Pretendard_600SemiBold", textDecorationLine: "underline" },
  pressed: { opacity: 0.65 },
});
