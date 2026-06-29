import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { apiFetch, ApiError } from "../api/client.js";
import { configureClient, setTokenAccessor } from "../config.js";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe("apiFetch", () => {
  beforeEach(() => {
    configureClient({ baseUrl: "http://api.test" });
    setTokenAccessor(() => null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prepends baseUrl and sends JSON content type", async () => {
    const f = mockFetch(200, { ok: true });
    vi.stubGlobal("fetch", f);
    await apiFetch("/ping");
    expect(f).toHaveBeenCalledWith(
      "http://api.test/ping",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });

  it("adds Authorization header when a token is present", async () => {
    const f = mockFetch(200, {});
    vi.stubGlobal("fetch", f);
    setTokenAccessor(() => "abc");
    await apiFetch("/secure");
    const headers = (f.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer abc");
  });

  it("calls onUnauthorized and throws ApiError(401) on 401 WITH a token", async () => {
    const onUnauthorized = vi.fn();
    configureClient({ baseUrl: "http://api.test", onUnauthorized });
    setTokenAccessor(() => "expired-token");
    vi.stubGlobal("fetch", mockFetch(401, {}));
    await expect(apiFetch("/secure")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("on 401 without a token surfaces server message and does not call onUnauthorized", async () => {
    const onUnauthorized = vi.fn();
    configureClient({ baseUrl: "http://api.test", onUnauthorized });
    vi.stubGlobal("fetch", mockFetch(401, { message: "이메일 또는 비밀번호가 올바르지 않습니다." }));
    await expect(apiFetch("/auth/login")).rejects.toMatchObject({
      status: 401,
      message: "이메일 또는 비밀번호가 올바르지 않습니다.",
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("throws ApiError with server message on non-2xx", async () => {
    vi.stubGlobal("fetch", mockFetch(400, { message: "bad input" }));
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 400, message: "bad input" });
  });

  it("joins array error messages from the server", async () => {
    vi.stubGlobal("fetch", mockFetch(400, { message: ["email must be an email", "password too short"] }));
    await expect(apiFetch("/x")).rejects.toMatchObject({
      status: 400,
      message: "email must be an email\npassword too short",
    });
  });

  it("returns undefined on 204", async () => {
    vi.stubGlobal("fetch", mockFetch(204, null));
    await expect(apiFetch("/no-content")).resolves.toBeUndefined();
  });

  it("returns undefined when a 2xx body is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      } as unknown as Response),
    );
    await expect(apiFetch("/empty-ok")).resolves.toBeUndefined();
  });
});
