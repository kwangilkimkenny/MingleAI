import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { enqueueMatchmaking, cancelMatchmaking, getMatchmakingStatus } from "../api/matchmaking.js";
import { configureClient, setTokenAccessor } from "../config.js";

describe("matchmaking api", () => {
  beforeEach(() => {
    configureClient({ baseUrl: "http://api.test" });
    setTokenAccessor(() => "test-token");
  });

  afterEach(() => vi.unstubAllGlobals());

  it("enqueue POSTs /matchmaking/queue", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "e1", status: "waiting", enqueuedAt: "t" }),
    } as Response);
    vi.stubGlobal("fetch", f);

    const res = await enqueueMatchmaking();
    const [url, opts] = f.mock.calls[0];
    expect(String(url)).toContain("/matchmaking/queue");
    expect(opts.method).toBe("POST");
    expect(res.status).toBe("waiting");
  });

  it("cancel DELETEs /matchmaking/queue", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => undefined,
    } as Response);
    vi.stubGlobal("fetch", f);

    await cancelMatchmaking();
    const [url, opts] = f.mock.calls[0];
    expect(String(url)).toContain("/matchmaking/queue");
    expect(opts.method).toBe("DELETE");
  });

  it("getStatus GETs /matchmaking/status", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "waiting", elapsedMs: 1200 }),
    } as Response);
    vi.stubGlobal("fetch", f);

    const res = await getMatchmakingStatus();
    expect(String(f.mock.calls[0][0])).toContain("/matchmaking/status");
    expect(res.status).toBe("waiting");
  });
});
