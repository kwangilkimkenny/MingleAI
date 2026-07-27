import { describe, it, expect } from "vitest";
import { nameFromUri, mimeFromName, initialOf } from "../photo-util";

describe("nameFromUri", () => {
  it("takes the last path segment", () => {
    expect(nameFromUri("file:///var/mobile/tmp/ABC-123.jpg")).toBe("ABC-123.jpg");
    expect(nameFromUri("content://media/external/images/42.png")).toBe("42.png");
  });

  it("appends .jpg when the tail has no extension", () => {
    expect(nameFromUri("file:///tmp/no-ext")).toBe("no-ext.jpg");
  });

  it("falls back to photo.jpg for a trailing slash", () => {
    expect(nameFromUri("file:///tmp/")).toBe("photo.jpg");
  });
});

describe("mimeFromName", () => {
  it("maps known extensions (case-insensitive)", () => {
    expect(mimeFromName("a.jpg")).toBe("image/jpeg");
    expect(mimeFromName("a.JPEG")).toBe("image/jpeg");
    expect(mimeFromName("a.png")).toBe("image/png");
    expect(mimeFromName("a.webp")).toBe("image/webp");
  });

  it("defaults to jpeg for unknown or missing extensions", () => {
    expect(mimeFromName("a.heic")).toBe("image/jpeg");
    expect(mimeFromName("noext")).toBe("image/jpeg");
  });
});

describe("initialOf", () => {
  it("returns the uppercased first grapheme", () => {
    expect(initialOf("alice")).toBe("A");
    expect(initialOf("  bob")).toBe("B");
  });

  it("keeps CJK / emoji as a single glyph", () => {
    expect(initialOf("민수")).toBe("민");
    expect(initialOf("🙂 hi")).toBe("🙂");
  });

  it("falls back to an empty circle when empty (doodle face retired 2026-07-27)", () => {
    expect(initialOf("")).toBe("");
    expect(initialOf(undefined)).toBe("");
    expect(initialOf("   ")).toBe("");
  });
});
