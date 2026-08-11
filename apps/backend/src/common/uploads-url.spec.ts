import { normalizeUploadUrl, PROFILE_PHOTO_PATH } from "./uploads-url";

describe("normalizeUploadUrl", () => {
  const OLD = process.env.PUBLIC_BASE_URL;
  afterEach(() => {
    if (OLD === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = OLD;
  });

  it("accepts our relative upload path", () => {
    expect(normalizeUploadUrl("/uploads/a.jpg")).toBe("/uploads/a.jpg");
  });

  it("accepts a LAN dev host when PUBLIC_BASE_URL is unset (emulator/device)", () => {
    delete process.env.PUBLIC_BASE_URL;
    expect(normalizeUploadUrl("http://10.0.2.2:3000/uploads/b.png")).toBe(
      "http://10.0.2.2:3000/uploads/b.png",
    );
    expect(normalizeUploadUrl("http://localhost:3000/uploads/b.png")).toBeTruthy();
  });

  // 2026-08-11 QA: 경로만 보던 시절 이 URL이 채팅 첨부로 저장돼 상대 IP·열람시각이 샜다.
  it("rejects a foreign host even when the path looks like ours", () => {
    delete process.env.PUBLIC_BASE_URL;
    expect(normalizeUploadUrl("https://evil.example.com/uploads/tracker.png")).toBeNull();
  });

  it("rejects any host but PUBLIC_BASE_URL once it is configured", () => {
    process.env.PUBLIC_BASE_URL = "https://api.mingles.cloud";
    expect(normalizeUploadUrl("https://api.mingles.cloud/uploads/c.webp")).toBeTruthy();
    expect(normalizeUploadUrl("http://10.0.2.2:3000/uploads/c.webp")).toBeNull();
    expect(normalizeUploadUrl("https://evil.example.com/uploads/c.webp")).toBeNull();
  });

  it("rejects traversal, nested paths, and non-upload paths", () => {
    expect(normalizeUploadUrl("/uploads/../../etc/passwd")).toBeNull();
    expect(normalizeUploadUrl("/uploads/sub/dir.png")).toBeNull();
    expect(normalizeUploadUrl("/etc/passwd")).toBeNull();
    expect(normalizeUploadUrl("uploads/a.jpg")).toBeNull();
    expect(normalizeUploadUrl("")).toBeNull();
    expect(normalizeUploadUrl(null)).toBeNull();
  });

  it("PROFILE_PHOTO_PATH only allows the uuid.ext names the uploader mints", () => {
    delete process.env.PUBLIC_BASE_URL;
    const uuid = "http://localhost:3000/uploads/9f3d1c2e-0000-4000-8000-abcdefabcdef.png";
    expect(normalizeUploadUrl(uuid, PROFILE_PHOTO_PATH)).toBe(uuid);
    expect(normalizeUploadUrl("/uploads/not-a-uuid.gif", PROFILE_PHOTO_PATH)).toBeNull();
  });
});
