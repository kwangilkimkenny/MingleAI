import { useEffect } from "react";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
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

  // 앱 전역 세로 고정(app.json orientation=portrait와 이중 안전벨트). 웹은 미지원 — no-op.
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

  // 헤더 전면 비표시 — 각 화면이 자체 크롬(백버튼·타이틀)을 가진다.
  // contentStyle: 전 화면이 다크라 내비게이터 배경도 다크로 고정 — 라이트로 두면 로그인→홈 전환
  // 틈에 크림 배경이 한 프레임 번쩍인다(2026-07-27 버그).
  // 앱은 전면 다크 — 상태바 아이콘은 밝게. 라이트 배경 화면(전폭 지도)은 그 화면에서 뒤집는다.
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: dark.bg } }} />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: dark.bg,
  },
});
