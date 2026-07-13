import { Stack } from "expo-router";
import { useFonts, Gaegu_400Regular, Gaegu_700Bold } from "@expo-google-fonts/gaegu";
import "../src/lib/client";
import { doodleHeaderOptions } from "../src/lib/theme";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  // Gaegu (handwriting) powers the display type. Fonts are bundled, so this resolves fast;
  // hold the first frame until they're ready so headings don't flash in the system fallback.
  const [fontsLoaded, fontError] = useFonts({ Gaegu_400Regular, Gaegu_700Bold });
  if (!fontsLoaded && !fontError) return null;

  return (
    <Stack screenOptions={{ headerTitle: "MingleAI", ...doodleHeaderOptions }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: "로그인" }} />
      <Stack.Screen name="register" options={{ title: "회원가입" }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ title: "프로필 설정" }} />
    </Stack>
  );
}
