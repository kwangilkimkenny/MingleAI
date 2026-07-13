import { colors, fonts } from "../src/lib/theme";
import { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Link, router } from "expo-router";
import { login, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";
import { DoodleButton, doodleInputStyle } from "../src/components/Doodle";

export default function Login() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { accessToken } = await login(email.trim(), password);
      if (!accessToken) {
        throw new Error("서버에서 토큰을 받지 못했습니다.");
      }
      setAuth({ token: accessToken });
      router.replace("/(app)/home");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>MingleAI</Text>
      <Text style={styles.tagline}>가벼운 만남, 편안한 연결</Text>
      <TextInput
        style={styles.input}
        placeholder="이메일"
        placeholderTextColor={colors.grayMid}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        placeholderTextColor={colors.grayMid}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <DoodleButton
        title={busy ? "로그인 중..." : "로그인"}
        onPress={onSubmit}
        disabled={busy}
        variant="primary"
      />
      <Link href="/register" style={styles.link}>
        계정이 없으신가요? 회원가입
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 14,
    backgroundColor: colors.paper,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 44,
    color: colors.ink,
    textAlign: "center",
  },
  tagline: { fontSize: 14, color: colors.grayMid, textAlign: "center", marginBottom: 8 },
  input: doodleInputStyle,
  error: { color: colors.ink, fontWeight: "600" },
  link: { marginTop: 16, color: colors.ink, textAlign: "center", textDecorationLine: "underline" },
});
