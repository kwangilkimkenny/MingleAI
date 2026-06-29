import { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { Link, router } from "expo-router";
import { login, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";

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
      <TextInput
        style={styles.input}
        placeholder="이메일"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={busy ? "로그인 중..." : "로그인"} onPress={onSubmit} disabled={busy} />
      <Link href="/register" style={styles.link}>
        계정이 없으신가요? 회원가입
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "red" },
  link: { marginTop: 16, color: "#3366ff", textAlign: "center" },
});
