import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Small semantic wrapper around native haptics.
 *
 * Web feedback is intentionally silent: vibration support and user expectations vary widely,
 * while iOS/Android map these calls to their native haptic engines. Every call is best-effort so
 * a device setting (Low Power Mode, disabled haptics, unsupported hardware) never blocks an action.
 */
function run(effect: () => Promise<void>) {
  if (Platform.OS === "web") return;
  void effect().catch(() => {});
}

export function hapticSelect() {
  run(() => Haptics.selectionAsync());
}

export function hapticImpact() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticWarning() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
