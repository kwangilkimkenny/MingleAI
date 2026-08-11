import { beforeEach, describe, expect, it, vi } from "vitest";

const reactNative = vi.hoisted(() => ({
  platform: { OS: "ios" },
  setVoiceDisguiseEnabled: vi.fn<(enabled: boolean) => Promise<boolean>>(),
}));

vi.mock("react-native", () => ({
  Platform: reactNative.platform,
  NativeModules: {
    LivekitReactNativeModule: {
      setVoiceDisguiseEnabled: reactNative.setVoiceDisguiseEnabled,
    },
  },
}));

import { setNativeVoiceDisguiseEnabled } from "./native-voice-disguise";

describe("setNativeVoiceDisguiseEnabled", () => {
  beforeEach(() => {
    reactNative.platform.OS = "ios";
    reactNative.setVoiceDisguiseEnabled.mockReset();
    reactNative.setVoiceDisguiseEnabled.mockResolvedValue(true);
  });

  it.each(["ios", "android"])("uses the native PCM processor on %s", async (platform) => {
    reactNative.platform.OS = platform;

    await expect(setNativeVoiceDisguiseEnabled(true)).resolves.toBe(true);
    expect(reactNative.setVoiceDisguiseEnabled).toHaveBeenCalledWith(true);
  });

  it("fails closed when the native processor rejects", async () => {
    reactNative.setVoiceDisguiseEnabled.mockRejectedValue(new Error("unavailable"));

    await expect(setNativeVoiceDisguiseEnabled(true)).resolves.toBe(false);
  });

  it("does not claim support on other platforms", async () => {
    reactNative.platform.OS = "web";

    await expect(setNativeVoiceDisguiseEnabled(true)).resolves.toBe(false);
    expect(reactNative.setVoiceDisguiseEnabled).not.toHaveBeenCalled();
    await expect(setNativeVoiceDisguiseEnabled(false)).resolves.toBe(true);
  });
});
