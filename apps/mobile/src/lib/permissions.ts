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
