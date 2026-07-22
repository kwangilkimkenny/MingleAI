import { LivekitTokenService } from "./livekit-token.service";

function svc(livekit: { url: string; apiKey: string; apiSecret: string }) {
  return new LivekitTokenService({ value: { livekit } } as any);
}

describe("LivekitTokenService", () => {
  it("builds deterministic per-pairing room names", () => {
    expect(LivekitTokenService.roomName("sess", 0, 1, 2)).toBe("sd_sess_s0_r1_p2");
  });

  it("returns empty access when LiveKit is not configured (dev / AI-fill)", async () => {
    const access = await svc({ url: "", apiKey: "", apiSecret: "" }).mint("id", "room", {
      canPublishVideo: false,
    });
    expect(access).toEqual({ url: "", token: "" });
  });

  it("returns empty access when only some LiveKit config is present", async () => {
    const access = await svc({ url: "wss://x", apiKey: "", apiSecret: "s" }).mint("id", "room", {
      canPublishVideo: true,
    });
    expect(access).toEqual({ url: "", token: "" });
  });
});
