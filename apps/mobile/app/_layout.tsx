import { useEffect } from "react";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useFonts } from "expo-font";
import { StyleSheet, View } from "react-native";
import "../src/lib/client";
import { LoginBackdrop } from "../src/components/LoginBackdrop";
import { colors, dark } from "../src/lib/theme";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  // Pretendard powers the whole type system (2026-07-24 dropped the Cafe24 Dongdong display face —
  // line-art is clean modern, hierarchy comes from size + weight + blush). Fonts are bundled
  // locally, so this resolves fast; hold the first frame until ready so text doesn't flash in the
  // system fallback.
  const [fontsLoaded, fontError] = useFonts({
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
      <View style={styles.loading}>
        <LoginBackdrop />
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
    backgroundColor: dark.bg,
  },
});
