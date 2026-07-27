import { View, Text, StyleSheet } from "react-native";
import { router, Stack } from "expo-router";
import { dark, fonts } from "../src/lib/theme";
import { DoodleButton } from "../src/components/Doodle";

/**
 * Custom unmatched-route screen — replaces Expo Router's default English "Unmatched Route"
 * page with an on-brand Korean dark-editorial screen.
 */
export default function NotFound() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "길을 잃었어요" }} />
      <Text style={styles.title}>페이지를 찾을 수 없어요</Text>
      <Text style={styles.subtitle}>주소가 바뀌었거나 사라진 화면이에요.</Text>
      <DoodleButton
        title="홈으로 돌아가기"
        variant="primary"
        tone="dark"
        onPress={() => router.replace("/")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    padding: 32,
    backgroundColor: dark.bg,
  },
  title: { fontFamily: fonts.display, fontSize: 28, color: dark.heading, textAlign: "center" },
  subtitle: { fontSize: 15, lineHeight: 22, color: dark.textMuted, textAlign: "center", marginBottom: 8 },
});
