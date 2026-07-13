import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getMyProfile, createProfile, updateProfile, uploadPhoto } from "../api/profiles.js";
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

  it("updateProfile PATCHes /profiles/:id with the given fields", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "p9", photoUrl: "http://api.test/uploads/z.png" }),
    } as Response);
    vi.stubGlobal("fetch", f);

    const result = await updateProfile("p9", { photoUrl: "http://api.test/uploads/z.png" });
    expect(result).toMatchObject({ id: "p9" });

    const [url, opts] = f.mock.calls[0];
    expect(String(url)).toBe("http://api.test/profiles/p9");
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body)).toEqual({ photoUrl: "http://api.test/uploads/z.png" });
  });

  it("uploadPhoto POSTs multipart to /uploads/photo without a forced Content-Type", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ url: "http://api.test/uploads/new.png" }),
    } as Response);
    vi.stubGlobal("fetch", f);

    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
    const result = await uploadPhoto(blob);
    expect(result).toEqual({ url: "http://api.test/uploads/new.png" });

    const [url, opts] = f.mock.calls[0];
    expect(String(url)).toBe("http://api.test/uploads/photo");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeInstanceOf(FormData);
    // Must NOT set Content-Type — fetch derives the multipart boundary itself.
    expect(opts.headers["Content-Type"]).toBeUndefined();
    expect(opts.headers.Authorization).toBe("Bearer test-token");
  });

  it("uploadPhoto accepts a React-Native {uri,name,type} part and hits the endpoint", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ url: "http://api.test/uploads/rn.jpg" }),
    } as Response);
    vi.stubGlobal("fetch", f);

    const result = await uploadPhoto({
      uri: "file:///tmp/photo.jpg",
      name: "photo.jpg",
      type: "image/jpeg",
    });
    expect(result).toEqual({ url: "http://api.test/uploads/rn.jpg" });
    expect(String(f.mock.calls[0][0])).toBe("http://api.test/uploads/photo");
  });

  it("uploadPhoto throws ApiError with the server message on failure", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다." }),
    } as Response);
    vi.stubGlobal("fetch", f);

    const blob = new Blob([new Uint8Array([0x00])], { type: "text/plain" });
    await expect(uploadPhoto(blob)).rejects.toMatchObject({
      status: 400,
      message: "JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.",
    });
  });
});
