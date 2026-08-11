import { NativeModules, Platform } from "react-native";

type LiveKitVoiceBridge = {
  setVoiceDisguiseEnabled?: (enabled: boolean) => Promise<boolean>;
};

/**
 * Enables publisher-side PCM processing. Android and iOS are implemented in the pinned LiveKit patch.
 * Unsupported platforms return false when enabling so the caller can keep the microphone muted.
 */
export async function setNativeVoiceDisguiseEnabled(enabled: boolean): Promise<boolean> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return !enabled;
  const bridge = NativeModules.LivekitReactNativeModule as LiveKitVoiceBridge | undefined;
  if (!bridge?.setVoiceDisguiseEnabled) return false;
  try {
    return (await bridge.setVoiceDisguiseEnabled(enabled)) === true;
  } catch {
    return false;
  }
}
