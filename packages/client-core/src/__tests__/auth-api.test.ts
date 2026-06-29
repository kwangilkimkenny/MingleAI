import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { login, register } from "../api/auth.js";
import { configureClient, setTokenAccessor } from "../config.js";

describe("auth api", () => {
  beforeEach(() => {
    configureClient({ baseUrl: "http://api.test" });
    setTokenAccessor(() => null);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("POSTs credentials to /auth/login and returns accessToken", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: "jwt" }),
    } as Response);
    vi.stubGlobal("fetch", f);

    const res = await login("a@b.com", "pw");
    expect(res.accessToken).toBe("jwt");
    expect(f).toHaveBeenCalledWith(
      "http://api.test/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "a@b.com", password: "pw" }),
      }),
    );
  });

  it("POSTs to /auth/register", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: "jwt2" }),
    } as Response);
    vi.stubGlobal("fetch", f);

    const res = await register("c@d.com", "pw2");
    expect(res.accessToken).toBe("jwt2");
    expect(f.mock.calls[0][0]).toBe("http://api.test/auth/register");
  });
});
