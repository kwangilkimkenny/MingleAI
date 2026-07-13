import { View, Text, StyleSheet } from "react-native";
import { router, Stack } from "expo-router";
import { colors, fonts } from "../src/lib/theme";
import { DoodleButton, DoodleCard } from "../src/components/Doodle";

/**
 * Custom unmatched-route screen — replaces Expo Router's default English "Unmatched Route"
 * page with an on-brand Korean B&W doodle screen.
 */
export default function NotFound() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "길을 잃었어요" }} />
      <DoodleCard tone="fill" rotate="-1.5deg" style={styles.card} contentStyle={styles.cardInner}>
        <Text style={styles.face}>( ˘･_･˘ )</Text>
      </DoodleCard>
      <Text style={styles.title}>페이지를 찾을 수 없어요</Text>
      <Text style={styles.subtitle}>주소가 바뀌었거나 사라진 화면이에요.</Text>
      <DoodleButton title="홈으로 돌아가기" variant="primary" onPress={() => router.replace("/")} />
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
    backgroundColor: colors.paper,
  },
  card: { alignSelf: "center", marginBottom: 8 },
  cardInner: { paddingVertical: 28, paddingHorizontal: 36 },
  face: { fontSize: 34, color: colors.ink, fontWeight: "700" },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, textAlign: "center" },
  subtitle: { fontSize: 14, color: colors.grayMid, textAlign: "center", marginBottom: 8 },
});
