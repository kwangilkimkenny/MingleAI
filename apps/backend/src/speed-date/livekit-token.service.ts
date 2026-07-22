import { Injectable, Logger } from "@nestjs/common";
import { SpeedDateConfigProvider } from "./speed-date.config";

export interface RoomAccess {
  /** LiveKit server URL (empty when LiveKit is not configured — dev/AI-fill). */
  url: string;
  /** Signed access token (empty when LiveKit is not configured). */
  token: string;
}

/** Minimal shape of livekit-server-sdk's AccessToken (avoids a compile-time dep on the package). */
interface AccessTokenLike {
  addGrant(grant: Record<string, unknown>): void;
  toJwt(): Promise<string>;
}

/**
 * Mints short-lived, room-scoped LiveKit access tokens. The `canPublishVideo` grant is the
 * server-side privacy boundary: pre-FACE stages get a token that cannot publish camera, so a
 * malicious client cannot leak video by ignoring the UI. `livekit-server-sdk` is ESM-only, so
 * it is lazy-imported (a top-level import would crash the CJS backend at load, like PushService).
 */
@Injectable()
export class LivekitTokenService {
  private readonly log = new Logger(LivekitTokenService.name);
  // Typed `any`/non-literal import: `livekit-server-sdk` is ESM-only AND may not be installed in
  // dev-without-media setups. A non-literal specifier keeps tsc from statically resolving it, so
  // the backend compiles either way; at runtime the real SDK loads once installed.
  private sdk: { AccessToken: new (k: string, s: string, o: unknown) => AccessTokenLike } | null | undefined;

  constructor(private readonly configProvider: SpeedDateConfigProvider) {}

  /** Deterministic private room name for a pairing — only the two paired sockets ever get a token. */
  static roomName(sessionId: string, stageIndex: number, roundIndex: number, pairIndex: number): string {
    return `sd_${sessionId}_s${stageIndex}_r${roundIndex}_p${pairIndex}`;
  }

  private get cfg() {
    return this.configProvider.value.livekit;
  }

  private async ensureSdk() {
    if (this.sdk !== undefined) return this.sdk;
    try {
      const spec = "livekit-server-sdk";
      this.sdk = (await import(spec)) as typeof this.sdk;
    } catch (err) {
      this.log.warn(`livekit-server-sdk failed to load — tokens disabled: ${err}`);
      this.sdk = null;
    }
    return this.sdk;
  }

  /**
   * Mint a token for `identity` to join `room`. Returns empty url/token when LiveKit is not
   * configured (the session logic still runs; the client simply has no media to connect to —
   * used by dev AI-fill and by unit tests).
   */
  async mint(
    identity: string,
    room: string,
    opts: { canPublishVideo: boolean; ttlMs?: number },
  ): Promise<RoomAccess> {
    const { url, apiKey, apiSecret } = this.cfg;
    if (!url || !apiKey || !apiSecret) return { url: "", token: "" };
    const sdk = await this.ensureSdk();
    if (!sdk) return { url: "", token: "" };

    const ttlSeconds = Math.ceil((opts.ttlMs ?? 15 * 60 * 1000) / 1000);
    const at = new sdk.AccessToken(apiKey, apiSecret, { identity, ttl: ttlSeconds });
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // Server-enforced media boundary: camera is only publishable at the FACE stage.
      canPublishSources: opts.canPublishVideo ? ["camera", "microphone"] : ["microphone"],
    });
    return { url, token: await at.toJwt() };
  }
}
