import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { socialLogin, devLogin, deleteAccount, submitConsents } from "../api/auth.js";
import { configureClient, setTokenAccessor } from "../config.js";

describe("auth api", () => {
  beforeEach(() => {
    configureClient({ baseUrl: "http://api.test" });
    setTokenAccessor(() => null);
  });

  afterEach(() => vi.unstubAllGlobals());

  function stubOk(json: unknown) {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => json } as Response);
    vi.stubGlobal("fetch", f);
    return f;
  }

  it("POSTs a provider code to /auth/social", async () => {
    const f = stubOk({ accessToken: "jwt" });
    const res = await socialLogin("kakao", "code123", "mingleai://cb", "verifier");
    expect(res.accessToken).toBe("jwt");
    expect(f).toHaveBeenCalledWith(
      "http://api.test/auth/social",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ provider: "kakao", code: "code123", redirectUri: "mingleai://cb", codeVerifier: "verifier" }),
      }),
    );
  });

  it("POSTs to /auth/dev-login", async () => {
    const f = stubOk({ accessToken: "devjwt" });
    await devLogin("dev@test.com", "admin");
    expect(f).toHaveBeenCalledWith(
      "http://api.test/auth/dev-login",
      expect.objectContaining({ body: JSON.stringify({ email: "dev@test.com", role: "admin" }) }),
    );
  });

  it("submitConsents POSTs the scopes", async () => {
    const f = stubOk({});
    await submitConsents(["terms", "privacy", "age19"]);
    expect(f).toHaveBeenCalledWith(
      "http://api.test/auth/consent",
      expect.objectContaining({ body: JSON.stringify({ scopes: ["terms", "privacy", "age19"] }) }),
    );
  });

  it("deleteAccount sends only the confirmation (no password)", async () => {
    const f = stubOk({});
    await deleteAccount();
    expect(f).toHaveBeenCalledWith(
      "http://api.test/auth/account",
      expect.objectContaining({ method: "DELETE", body: JSON.stringify({ confirmation: "DELETE" }) }),
    );
  });
});
