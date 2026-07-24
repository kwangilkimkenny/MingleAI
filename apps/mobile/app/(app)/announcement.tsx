import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { dark, layout, space, type } from "../../src/lib/theme";
import { serifFont } from "../../src/lib/serif";

/**
 * 공지 상세 — 알림 팝업에서 공지를 탭하면 홈 위에 살짝 투명하게(홈이 은은히 비침) 뜨는 전체화면
 * 오버레이(라우트는 transparentModal). 타이틀 텍스트 없이 뒤로가기만, 명조 헤드라인 + 본문.
 */
export default function AnnouncementScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ title?: string; message?: string }>();
  const title = typeof params.title === "string" ? params.title : "";
  const message = typeof params.message === "string" ? params.message : "";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
      >
        <ChevronLeft color={dark.text} size={26} strokeWidth={2} />
      </Pressable>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.x8 }]}
      >
        {title ? (
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        ) : null}
        <View style={styles.rule} />
        <Text style={styles.body}>{message}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // 조금만 투명 — 대부분 다크, 홈이 뒤로 은은히 비친다(transparentModal).
  root: { flex: 1, backgroundColor: "rgba(26,20,15,0.92)" },
  back: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: space.x2,
    marginTop: space.x1,
  },
  content: { paddingHorizontal: layout.screenGutter, paddingTop: space.x4 },
  title: { fontFamily: serifFont, fontSize: 28, lineHeight: 38, color: dark.text, letterSpacing: -0.3 },
  rule: { height: 1, backgroundColor: dark.line, marginVertical: space.x5 },
  body: { ...type.body, fontSize: 16, lineHeight: 27, color: dark.text },
});
