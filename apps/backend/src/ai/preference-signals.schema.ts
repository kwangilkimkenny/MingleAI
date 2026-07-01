import { z } from "zod";
import type { PreferenceSignals } from "@mingle/shared";

const KNOWN_KEYS = ["vibe", "activity", "drinking", "pace", "tags", "summary"];

const normalizeList = (a: unknown): string[] =>
  Array.isArray(a)
    ? a
        .filter((s): s is string => typeof s === "string")
        .slice(0, 50)
        .map((s) => s.toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];

const sanitizeSummary = (s: unknown): string => {
  if (typeof s !== "string") return "";
  const cleaned = String(s)
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .trim();
  return Array.from(cleaned).slice(0, 120).join("");
};

const schema = z.object({
  vibe: z.enum(["calm", "energetic", "balanced"]).catch("balanced"),
  activity: z.unknown().transform(normalizeList),
  drinking: z.enum(["none", "light", "social"]).catch("light"),
  pace: z.enum(["slow", "medium", "fast"]).catch("medium"),
  tags: z.unknown().transform(normalizeList),
  summary: z.unknown().transform(sanitizeSummary),
});

export function parsePreferenceSignals(raw: unknown): PreferenceSignals {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("preference signals must be a JSON object");
  }
  if (!KNOWN_KEYS.some((k) => k in (raw as Record<string, unknown>))) {
    throw new Error("no recognizable preference fields in LLM response");
  }
  return schema.parse(raw) as PreferenceSignals;
}
