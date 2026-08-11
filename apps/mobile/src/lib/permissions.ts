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

/**
 * 마이크만 요청한다. 세션 진입 게이트는 이것만 본다 — 카메라는 3단계(얼굴 공개)에서야 쓰는데
 * 진입부터 요구하면 첫 두 단계도 못 해보고 이탈한다(2026-08-11 QA).
 */
export async function requestMic(): Promise<boolean> {
  if (Platform.OS === "web") {
    try {
      const media = (globalThis.navigator as Navigator | undefined)?.mediaDevices;
      const stream = await media?.getUserMedia({ audio: true });
      stream?.getTracks().forEach((t) => t.stop());
      if (stream) return true;
    } catch {
      // fall through
    }
    return (await getCameraMicStatus()).microphone;
  }
  return (await Camera.requestMicrophonePermissionsAsync()).granted;
}

/** 카메라만 요청한다. 얼굴 공개 단계로 넘어가기 직전에 부른다. 거부해도 세션은 계속된다(아바타). */
export async function requestCamera(): Promise<boolean> {
  if (Platform.OS === "web") {
    try {
      const media = (globalThis.navigator as Navigator | undefined)?.mediaDevices;
      const stream = await media?.getUserMedia({ video: true });
      stream?.getTracks().forEach((t) => t.stop());
      if (stream) return true;
    } catch {
      // fall through
    }
    return (await getCameraMicStatus()).camera;
  }
  return (await Camera.requestCameraPermissionsAsync()).granted;
}

/** True when the user permanently denied and must re-enable in OS settings (no reprompt possible). */
export async function isPermanentlyDenied(): Promise<boolean> {
  const [cam, mic] = await Promise.all([
    Camera.getCameraPermissionsAsync(),
    Camera.getMicrophonePermissionsAsync(),
  ]);
  return (!cam.granted && !cam.canAskAgain) || (!mic.granted && !mic.canAskAgain);
}
