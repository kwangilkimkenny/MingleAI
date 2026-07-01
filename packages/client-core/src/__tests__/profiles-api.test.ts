import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getMyProfile, createProfile } from "../api/profiles.js";
import { configureClient, setTokenAccessor } from "../config.js";

describe("profiles api", () => {
  beforeEach(() => {
    configureClient({ baseUrl: "http://api.test" });
    setTokenAccessor(() => "test-token");
  });

  afterEach(() => vi.unstubAllGlobals());

  it("getMyProfile returns null on 404", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);
    vi.stubGlobal("fetch", f);

    const result = await getMyProfile();
    expect(result).toBeNull();
  });

  it("getMyProfile returns the profile on success", async () => {
    const profile = {
      id: "p1",
      userId: "u1",
      name: "Alice",
      age: 27,
      gender: "female",
      occupation: "designer",
      partyPreferenceText: "chill vibes",
      riskScore: 0,
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => profile,
    } as Response);
    vi.stubGlobal("fetch", f);

    const result = await getMyProfile();
    expect(result).toEqual(profile);
    expect(f).toHaveBeenCalledWith(
      "http://api.test/profiles/me",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });

  it("getMyProfile rethrows non-404 errors", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "server error" }),
    } as Response);
    vi.stubGlobal("fetch", f);

    await expect(getMyProfile()).rejects.toMatchObject({ status: 500 });
  });

  it("createProfile POSTs to /profiles and returns the profile", async () => {
    const profile = {
      id: "p1",
      userId: "u1",
      name: "Bob",
      age: 30,
      gender: "male",
      occupation: "dev",
      partyPreferenceText: "rooftop parties",
      riskScore: 0,
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => profile,
    } as Response);
    vi.stubGlobal("fetch", f);

    const input = {
      name: "Bob",
      age: 30,
      gender: "male",
      occupation: "dev",
      partyPreferenceText: "rooftop parties",
    };
    const result = await createProfile(input);
    expect(result).toEqual(profile);

    const [url, opts] = f.mock.calls[0];
    expect(String(url)).toBe("http://api.test/profiles");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(input);
  });
});
