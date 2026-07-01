import { z } from "zod";
import type { PreferenceSignals } from "@mingle/shared";

const normalizeList = (a: unknown): string[] =>
  Array.isArray(a)
    ? a.map((s) => String(s).toLowerCase().trim()).filter(Boolean).slice(0, 10)
    : [];

const schema = z.object({
  vibe: z.enum(["calm", "energetic", "balanced"]).catch("balanced"),
  activity: z.unknown().transform(normalizeList),
  drinking: z.enum(["none", "light", "social"]).catch("light"),
  pace: z.enum(["slow", "medium", "fast"]).catch("medium"),
  tags: z.unknown().transform(normalizeList),
  summary: z.unknown().transform((s) => (typeof s === "string" ? s.trim().slice(0, 120) : "")),
});

export function parsePreferenceSignals(raw: unknown): PreferenceSignals {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("preference signals must be a JSON object");
  }
  return schema.parse(raw) as PreferenceSignals;
}
