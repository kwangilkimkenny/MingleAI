import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAccountStatus: vi.fn(),
  getMyProfile: vi.fn(),
  getCameraMicStatus: vi.fn(),
  nextGate: vi.fn(),
}));

vi.mock("@mingle/client-core", () => ({
  getAccountStatus: mocks.getAccountStatus,
  getMyProfile: mocks.getMyProfile,
  nextGate: mocks.nextGate,
}));

vi.mock("../permissions", () => ({
  getCameraMicStatus: mocks.getCameraMicStatus,
}));

import {
  primeAccountGate,
  resolveAccountGate,
  takePrimedAccountGate,
} from "../account-gate";

describe("account gate transition cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    takePrimedAccountGate();
  });

  it("hands a primed gate to the next layout exactly once", () => {
    primeAccountGate({ phase: "ready", profileId: "profile-1" });

    expect(takePrimedAccountGate()).toEqual({ phase: "ready", profileId: "profile-1" });
    expect(takePrimedAccountGate()).toBeNull();
  });

  it("resolves the ready profile before navigation", async () => {
    mocks.getAccountStatus.mockResolvedValue({ ready: true });
    mocks.getCameraMicStatus.mockResolvedValue({ camera: true, microphone: true });
    mocks.nextGate.mockReturnValue("ready");
    mocks.getMyProfile.mockResolvedValue({ id: "profile-1" });

    await expect(resolveAccountGate()).resolves.toEqual({
      phase: "ready",
      profileId: "profile-1",
    });
  });

  it("does not request a profile before the onboarding gates are complete", async () => {
    mocks.getAccountStatus.mockResolvedValue({ ready: false });
    mocks.getCameraMicStatus.mockResolvedValue({ camera: true, microphone: true });
    mocks.nextGate.mockReturnValue("consent");

    await expect(resolveAccountGate()).resolves.toEqual({ phase: "consent" });
    expect(mocks.getMyProfile).not.toHaveBeenCalled();
  });
});
