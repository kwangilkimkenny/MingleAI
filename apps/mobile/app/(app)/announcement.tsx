import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppScreen } from "../../src/components/AppScreen";
import { dark, space, type } from "../../src/lib/theme";
import { serifFont } from "../../src/lib/serif";

/**
 * 공지 상세 — 알림 팝업에서 공지를 탭하면 열리는 전체화면 상세글. 홈 테마(다크) 에디토리얼:
 * 명조 헤드라인 + 넉넉한 본문. 제목·본문은 라우트 파라미터로 받는다.
 */
export default function AnnouncementScreen() {
  const params = useLocalSearchParams<{ title?: string; message?: string }>();
  const title = typeof params.title === "string" ? params.title : "공지";
  const message = typeof params.message === "string" ? params.message : "";

  return (
    <AppScreen tone="dark" header={{ back: true, title: "공지" }} body="scroll" contentStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <View style={styles.rule} />
      <Text style={styles.body}>{message}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.x6 },
  title: { fontFamily: serifFont, fontSize: 28, lineHeight: 38, color: dark.text, letterSpacing: -0.3 },
  rule: { height: 1, backgroundColor: dark.line, marginVertical: space.x5 },
  body: { ...type.body, fontSize: 16, lineHeight: 27, color: dark.text },
});
