import { describe, it, expect } from "vitest";
import { stageReveal, projectPartner } from "./projection.js";

describe("stageReveal", () => {
  it("publishes camera only at the FACE stage", () => {
    expect(stageReveal("DISGUISED").video).toBe(false);
    expect(stageReveal("VOICE").video).toBe(false);
    expect(stageReveal("FACE").video).toBe(true);
  });

  it("modulates voice only at the DISGUISED stage", () => {
    expect(stageReveal("DISGUISED").voiceMod).toBe(true);
    expect(stageReveal("VOICE").voiceMod).toBe(false);
    expect(stageReveal("FACE").voiceMod).toBe(false);
  });
});

describe("projectPartner", () => {
  const partner = { profileId: "p1", nickname: "코랄", gender: "female", avatarId: "av3" };

  it("redacts to nickname/gender/avatar and applies the stage reveal", () => {
    const disguised = projectPartner("DISGUISED", partner);
    expect(disguised).toEqual({
      profileId: "p1",
      nickname: "코랄",
      gender: "female",
      avatarId: "av3",
      video: false,
      voiceMod: true,
    });
  });

  it("exposes video (face) at FACE but still no real name/photo keys", () => {
    const face = projectPartner("FACE", partner);
    expect(face.video).toBe(true);
    expect(Object.keys(face).sort()).toEqual(
      ["avatarId", "gender", "nickname", "profileId", "video", "voiceMod"].sort(),
    );
  });

  it("carries the AI flag through only when set", () => {
    expect(projectPartner("VOICE", partner).isAi).toBeUndefined();
    expect(projectPartner("VOICE", { ...partner, isAi: true }).isAi).toBe(true);
  });
});
