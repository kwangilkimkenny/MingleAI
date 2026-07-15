import { Stack } from "expo-router";
import { useFonts, Gaegu_400Regular, Gaegu_700Bold } from "@expo-google-fonts/gaegu";
import "../src/lib/client";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  // Gaegu (handwriting) powers the display type. Fonts are bundled, so this resolves fast;
  // hold the first frame until they're ready so headings don't flash in the system fallback.
  const [fontsLoaded, fontError] = useFonts({ Gaegu_400Regular, Gaegu_700Bold });
  if (!fontsLoaded && !fontError) return null;

  // 헤더 전면 비표시 — 인증 화면은 DoodleHero가 브랜딩을 담당하고, 탭/상세는 자체 크롬을 가진다.
  return <Stack screenOptions={{ headerShown: false }} />;
}
