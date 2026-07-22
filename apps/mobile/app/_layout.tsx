import { useEffect } from "react";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useFonts } from "expo-font";
import { Gaegu_400Regular } from "@expo-google-fonts/gaegu/400Regular";
import { Gaegu_700Bold } from "@expo-google-fonts/gaegu/700Bold";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import "../src/lib/client";
import { colors, fonts, type } from "../src/lib/theme";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  // Gaegu (handwriting) powers the display type. Fonts are bundled, so this resolves fast;
  // hold the first frame until they're ready so headings don't flash in the system fallback.
  const [fontsLoaded, fontError] = useFonts({
    Gaegu_400Regular,
    Gaegu_700Bold,
    Pretendard_400Regular: require("../assets/fonts/pretendard/Pretendard-Regular.otf"),
    Pretendard_600SemiBold: require("../assets/fonts/pretendard/Pretendard-SemiBold.otf"),
  });

  // app.json orientation="default"(runtime lock을 위해 필요) 상태에서 앱 전역은 세로 고정.
  // 파티 화면만 useLandscapeLock으로 가로 전환. 웹은 미지원 — no-op.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loading} accessibilityLiveRegion="polite">
        <Text style={styles.brand}>mingle</Text>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>만남을 준비하고 있어요</Text>
      </View>
    );
  }

  // 헤더 전면 비표시 — 인증 화면은 DoodleHero가 브랜딩을 담당하고, 탭/상세는 자체 크롬을 가진다.
  // contentStyle: 내비게이터 기본 배경(#F2F2F2)이 전환 틈에 비치지 않게 종이색으로 고정.
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.paper,
  },
  brand: { fontFamily: fonts.display, fontSize: 38, color: colors.ink },
  loadingText: { ...type.caption, color: colors.grayDark },
});
