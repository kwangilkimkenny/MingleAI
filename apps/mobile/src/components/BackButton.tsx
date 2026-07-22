import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { colors } from "../lib/theme";
import { control, fonts } from "../lib/theme";

/**
 * Small B&W back affordance for detail screens whose Stack header is hidden.
 * Adds the safe-area top inset (notch on native, 0 on web) so it clears the status bar.
 * Falls back to the home tab when there is no back entry (e.g. deep link).
 */
export function BackButton({ label = "뒤로", onPress }: { label?: string; onPress?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace("/home")))}
      style={[styles.btn, { marginTop: insets.top }]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="뒤로 가기"
    >
      <ChevronLeft color={colors.ink} size={22} strokeWidth={2.5} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: control.minTouch,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  label: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 21, color: colors.ink },
});
