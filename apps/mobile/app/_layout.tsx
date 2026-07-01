import { Stack } from "expo-router";
import "../src/lib/client";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTitle: "MingleAI" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: "로그인" }} />
      <Stack.Screen name="register" options={{ title: "회원가입" }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ title: "프로필 설정" }} />
    </Stack>
  );
}
