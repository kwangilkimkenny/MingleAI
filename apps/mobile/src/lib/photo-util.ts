/**
 * Pure helpers for profile-photo handling — deliberately free of native/expo
 * imports so they run under the mobile Vitest suite (src/lib/__tests__).
 */

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Filename from a file:// (or content://) URI; ensures an extension. */
export function nameFromUri(uri: string): string {
  const tail = uri.split("/").pop() || "photo.jpg";
  return tail.includes(".") ? tail : `${tail}.jpg`;
}

/** Best-effort image MIME from a filename extension; defaults to JPEG. */
export function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "image/jpeg";
}

/** First visible grapheme of a name, uppercased; falls back to a face motif. */
export function initialOf(name?: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return ""; // 이름 전 = 빈 원(두들 스마일 폐기 — 2026-07-27)
  // Array spread splits by code point so emoji / CJK render as one glyph.
  return [...trimmed][0].toUpperCase();
}
