import { Platform } from "react-native";
import { Camera } from "expo-camera";
import type { PermissionState } from "@mingle/client-core";

/** Current camera + microphone OS permission grants (does not prompt). */
export async function getCameraMicStatus(): Promise<PermissionState> {
  const [cam, mic] = await Promise.all([
    Camera.getCameraPermissionsAsync(),
    Camera.getMicrophonePermissionsAsync(),
  ]);
  return { camera: cam.granted, microphone: mic.granted };
}

/** Prompt for camera + microphone. Returns the resulting grant state. */
export async function requestCameraMic(): Promise<PermissionState> {
  // On web, expo-camera fires TWO separate getUserMedia prompts (video, then audio); a user who
  // grants only the first is left permanently short of the gate. A single getUserMedia({video,audio})
  // is one atomic prompt that grants both together.
  if (Platform.OS === "web") {
    try {
      const media = (globalThis.navigator as Navigator | undefined)?.mediaDevices;
      const stream = await media?.getUserMedia({ video: true, audio: true });
      stream?.getTracks().forEach((t) => t.stop());
      if (stream) return { camera: true, microphone: true };
    } catch {
      // fall through to the status query (denied/dismissed)
    }
    return getCameraMicStatus();
  }
  const cam = await Camera.requestCameraPermissionsAsync();
  const mic = await Camera.requestMicrophonePermissionsAsync();
  return { camera: cam.granted, microphone: mic.granted };
}

/** True when the user permanently denied and must re-enable in OS settings (no reprompt possible). */
export async function isPermanentlyDenied(): Promise<boolean> {
  const [cam, mic] = await Promise.all([
    Camera.getCameraPermissionsAsync(),
    Camera.getMicrophonePermissionsAsync(),
  ]);
  return (!cam.granted && !cam.canAskAgain) || (!mic.granted && !mic.canAskAgain);
}
