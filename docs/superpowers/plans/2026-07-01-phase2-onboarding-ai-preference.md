# Phase 2 — Onboarding + AI Preference Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add profile onboarding (gender/age/occupation + natural-language party preference) that, on submit, runs a self-served OpenAI-compatible LLM to produce a structured `preferenceSignals` object stored on the Profile.

**Architecture:** A `PreferenceAnalyzer` interface (Nest DI) with two impls — `OpenAICompatPreferenceAnalyzer` (real, env-configured `/v1/chat/completions`) and `StubPreferenceAnalyzer` (deterministic, for dev/CI/tests). `ProfileService.create` calls the analyzer synchronously with a resilient fallback (LLM failure → profile created with `preferenceSignals: null`, retryable). Mobile gates on `GET /profiles/me`, routing profile-less users to an onboarding form.

**Tech Stack:** NestJS 10, Prisma 6, `zod` (new), class-validator, Node 26 native `fetch`; Expo Router + `@mingle/client-core` + `apiFetch`; `@mingle/shared` types. Jest + Vitest.

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-01-phase2-onboarding-ai-preference-design.md`.
- **Scope:** onboarding + AI preference analysis ONLY. No matchmaking queue / party / 2D / messenger.
- **LLM wire contract:** OpenAI-compatible `POST ${LLM_API_URL}${LLM_CHAT_PATH}` (default path `/v1/chat/completions`); base URL, path, key, model all env-injected (`LLM_API_URL`/`LLM_CHAT_PATH`/`LLM_API_KEY`/`LLM_MODEL`/`LLM_TIMEOUT_MS`). No code change to swap endpoints. `LLM_API_URL` unset → StubPreferenceAnalyzer (keeps dev/CI/boot green with no endpoint).
- **`PreferenceSignals` shape (exact):** `{ vibe: "calm"|"energetic"|"balanced"; activity: string[]; drinking: "none"|"light"|"social"; pace: "slow"|"medium"|"fast"; tags: string[]; summary: string }`. Prisma column stays `Json?` (NO migration). `null` = not analyzed / needs (re)analysis.
- **Resilience:** LLM failure/timeout/unrecoverable-parse → `PreferenceAnalysisError`; caller logs a warning and leaves `preferenceSignals: null`. Onboarding never hard-fails on an LLM hiccup.
- **Env quirks:** `pnpm install --ignore-scripts` only (plain install fails on better-sqlite3). Postgres up via `docker compose up -d`; `apps/backend/.env` present (gitignored). Do NOT run `prisma migrate*` (blocked by env policy; and no migration is needed this phase). `prisma generate` is allowed. Grep for TS errors ANSI-safe: strip `\x1b\[[0-9;]*m` or grep `Found N error` (a naive `grep "error TS"` returns 0 due to ANSI codes).
- **Green targets:** `@mingle/backend`, `@mingle/shared`, `@mingle/client-core`, `apps/mobile`. Do NOT touch `apps/web` / `@mingle/mingleai-mcp`.
- Also fix Phase 1 rollup items in the profile work: `update-profile.dto` `occupation` gets `@IsNotEmpty()`; duplicate-profile create throws `ConflictException` (409) not `BadRequestException`.

## File Structure

```
packages/shared/src/types/preference.ts        # NEW: PreferenceSignals + enums
packages/shared/src/index.ts                    # export the new type
apps/backend/
├── package.json                                # + zod dep
├── .env.example                                # + LLM_* vars
├── src/ai/
│   ├── preference-analyzer.interface.ts        # NEW: PreferenceAnalyzer, AnalyzeInput, PREFERENCE_ANALYZER token, PreferenceAnalysisError
│   ├── preference-signals.schema.ts            # NEW: zod schema + parse/coerce helper
│   ├── stub-preference-analyzer.ts             # NEW: deterministic impl
│   ├── openai-compat-preference-analyzer.ts    # NEW: real impl (fetch)
│   ├── ai.module.ts                            # NEW: provides PREFERENCE_ANALYZER (real vs stub by env)
│   └── *.spec.ts                               # tests
├── src/profile/
│   ├── profile.service.ts                      # wire analyzer into create/update + reanalyze + ConflictException
│   ├── profile.controller.ts                   # + GET /profiles/me, POST /profiles/me/reanalyze
│   ├── profile.module.ts                       # import AiModule
│   ├── dto/create-profile.dto.ts               # drop preferenceSignals
│   ├── dto/update-profile.dto.ts               # occupation @IsNotEmpty
│   └── profile.service.spec.ts                 # analyzer integration tests
packages/client-core/src/api/profiles.ts        # NEW: getMyProfile, createProfile
packages/client-core/src/index.ts               # export profiles api
apps/mobile/
├── src/lib/profile.ts                           # NEW: useMyProfile gate helper (apiFetch)
├── app/(app)/_layout.tsx                        # gate: no profile → /onboarding
└── app/onboarding.tsx                           # NEW: onboarding form
```

---

## Task 1: `@mingle/shared` — `PreferenceSignals` type

**Files:**
- Create: `packages/shared/src/types/preference.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `PreferenceSignals`, `PreferenceVibe`, `PreferenceDrinking`, `PreferencePace` (consumed by Tasks 2–6).

- [ ] **Step 1: Create the type module**

`packages/shared/src/types/preference.ts`:
```ts
export type PreferenceVibe = "calm" | "energetic" | "balanced";
export type PreferenceDrinking = "none" | "light" | "social";
export type PreferencePace = "slow" | "medium" | "fast";

export interface PreferenceSignals {
  vibe: PreferenceVibe;
  activity: string[];
  drinking: PreferenceDrinking;
  pace: PreferencePace;
  tags: string[];
  summary: string;
}
```

- [ ] **Step 2: Export from the barrel**

In `packages/shared/src/index.ts` add (using the existing `./types/<file>.js` convention):
```ts
export type {
  PreferenceVibe,
  PreferenceDrinking,
  PreferencePace,
  PreferenceSignals,
} from "./types/preference.js";
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @mingle/shared build`
Expected: `tsc` clean; `dist/index.d.ts` exports `PreferenceSignals`.

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add PreferenceSignals type for AI preference analysis"
```

---

## Task 2: Backend `ai/` — interface, zod schema, Stub analyzer (TDD)

**Files:**
- Modify: `apps/backend/package.json` (+ `zod`)
- Create: `apps/backend/src/ai/preference-analyzer.interface.ts`, `preference-signals.schema.ts`, `stub-preference-analyzer.ts`, `stub-preference-analyzer.spec.ts`, `preference-signals.schema.spec.ts`

**Interfaces:**
- Consumes: `PreferenceSignals` (Task 1).
- Produces: `PreferenceAnalyzer` interface, `AnalyzeInput`, `PREFERENCE_ANALYZER` (DI token), `PreferenceAnalysisError`, `parsePreferenceSignals(raw: unknown): PreferenceSignals`, `StubPreferenceAnalyzer` (consumed by Tasks 3–4).

- [ ] **Step 1: Add zod**

Edit `apps/backend/package.json` dependencies: add `"zod": "^3.23.8"`. Then:
```bash
pnpm install --ignore-scripts
```
Expected: zod resolves under the workspace.

- [ ] **Step 2: Interface + error + DI token**

`apps/backend/src/ai/preference-analyzer.interface.ts`:
```ts
import type { PreferenceSignals } from "@mingle/shared";

export interface AnalyzeInput {
  partyPreferenceText: string;
  gender: string;
  age: number;
  occupation: string;
}

export interface PreferenceAnalyzer {
  analyze(input: AnalyzeInput): Promise<PreferenceSignals>;
}

export const PREFERENCE_ANALYZER = Symbol("PREFERENCE_ANALYZER");

export class PreferenceAnalysisError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "PreferenceAnalysisError";
  }
}
```

- [ ] **Step 3: Write the failing schema test**

`apps/backend/src/ai/preference-signals.schema.spec.ts`:
```ts
import { parsePreferenceSignals } from "./preference-signals.schema";

describe("parsePreferenceSignals", () => {
  it("accepts a well-formed object", () => {
    const out = parsePreferenceSignals({
      vibe: "calm", activity: ["Boardgame"], drinking: "none",
      pace: "slow", tags: ["Quiet", "boardgame"], summary: "조용한 보드게임 모임",
    });
    expect(out.vibe).toBe("calm");
    expect(out.activity).toEqual(["boardgame"]);      // lowercased+trimmed
    expect(out.tags).toEqual(["quiet", "boardgame"]);
    expect(out.drinking).toBe("none");
  });

  it("coerces unknown enums to safe defaults and clamps arrays/summary", () => {
    const out = parsePreferenceSignals({
      vibe: "wild", drinking: "heavy", pace: "instant",
      activity: Array.from({ length: 20 }, (_, i) => `a${i}`),
      tags: undefined, summary: "x".repeat(200),
    });
    expect(out.vibe).toBe("balanced");
    expect(out.drinking).toBe("light");
    expect(out.pace).toBe("medium");
    expect(out.activity).toHaveLength(10);
    expect(out.tags).toEqual([]);
    expect(out.summary).toHaveLength(120);
  });

  it("throws when the input is not an object", () => {
    expect(() => parsePreferenceSignals("nope")).toThrow();
    expect(() => parsePreferenceSignals(null)).toThrow();
  });
});
```
Run: `pnpm --filter @mingle/backend test -- preference-signals.schema` → FAIL (module missing).

- [ ] **Step 4: Implement the zod schema + helper**

`apps/backend/src/ai/preference-signals.schema.ts`:
```ts
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
```
Run: `pnpm --filter @mingle/backend test -- preference-signals.schema` → PASS.

- [ ] **Step 5: Write the failing Stub test**

`apps/backend/src/ai/stub-preference-analyzer.spec.ts`:
```ts
import { StubPreferenceAnalyzer } from "./stub-preference-analyzer";

describe("StubPreferenceAnalyzer", () => {
  const a = new StubPreferenceAnalyzer();

  it("maps quiet boardgame text to calm/boardgame/none", async () => {
    const out = await a.analyze({
      partyPreferenceText: "조용히 보드게임 하면서 술 없이 천천히",
      gender: "female", age: 27, occupation: "designer",
    });
    expect(out.vibe).toBe("calm");
    expect(out.activity).toContain("boardgame");
    expect(out.drinking).toBe("none");
    expect(out.pace).toBe("slow");
  });

  it("is deterministic and always returns valid signals", async () => {
    const input = { partyPreferenceText: "활발하게 떠들기", gender: "male", age: 30, occupation: "dev" };
    const a1 = await a.analyze(input);
    const a2 = await a.analyze(input);
    expect(a1).toEqual(a2);
    expect(a1.vibe).toBe("energetic");
  });
});
```
Run: `pnpm --filter @mingle/backend test -- stub-preference-analyzer` → FAIL.

- [ ] **Step 6: Implement StubPreferenceAnalyzer**

`apps/backend/src/ai/stub-preference-analyzer.ts`:
```ts
import { Injectable } from "@nestjs/common";
import type { PreferenceSignals } from "@mingle/shared";
import type { AnalyzeInput, PreferenceAnalyzer } from "./preference-analyzer.interface";
import { parsePreferenceSignals } from "./preference-signals.schema";

@Injectable()
export class StubPreferenceAnalyzer implements PreferenceAnalyzer {
  async analyze(input: AnalyzeInput): Promise<PreferenceSignals> {
    const t = input.partyPreferenceText.toLowerCase();
    const has = (...w: string[]) => w.some((x) => t.includes(x));
    const vibe = has("조용", "차분", "calm", "quiet") ? "calm"
      : has("활발", "신나", "energetic") ? "energetic" : "balanced";
    const drinking = has("술 없", "논알콜", "no drink", "술없") ? "none"
      : has("가볍게 한잔", "light") ? "light" : "social";
    const pace = has("천천", "slow") ? "slow" : has("빠르", "fast") ? "fast" : "medium";
    const activity: string[] = [];
    if (has("보드게임", "boardgame")) activity.push("boardgame");
    if (has("떠들", "수다", "talk")) activity.push("talking");
    if (has("게임", "game") && !activity.includes("boardgame")) activity.push("game");
    return parsePreferenceSignals({
      vibe, activity, drinking, pace,
      tags: activity, summary: input.partyPreferenceText.slice(0, 120),
    });
  }
}
```
Run: `pnpm --filter @mingle/backend test -- stub-preference-analyzer` → PASS.

- [ ] **Step 7: Build + commit**

Run: `pnpm --filter @mingle/backend build` (ANSI-safe error check) → clean.
```bash
git add apps/backend/package.json apps/backend/src/ai pnpm-lock.yaml
git commit -m "feat(backend): PreferenceAnalyzer interface + zod signals schema + stub analyzer"
```

---

## Task 3: `OpenAICompatPreferenceAnalyzer` + `AiModule` (TDD)

**Files:**
- Create: `apps/backend/src/ai/openai-compat-preference-analyzer.ts`, `openai-compat-preference-analyzer.spec.ts`, `apps/backend/src/ai/ai.module.ts`
- Modify: `apps/backend/.env.example`

**Interfaces:**
- Consumes: `PreferenceAnalyzer`/`AnalyzeInput`/`PreferenceAnalysisError` (Task 2), `parsePreferenceSignals` (Task 2), `@nestjs/config`.
- Produces: `OpenAICompatPreferenceAnalyzer`, `AiModule` (exports `PREFERENCE_ANALYZER`).

- [ ] **Step 1: Write the failing analyzer test (fetch mocked)**

`apps/backend/src/ai/openai-compat-preference-analyzer.spec.ts`:
```ts
import { OpenAICompatPreferenceAnalyzer } from "./openai-compat-preference-analyzer";
import { PreferenceAnalysisError } from "./preference-analyzer.interface";

const cfg = {
  url: "https://llm.example.com", chatPath: "/v1/chat/completions",
  apiKey: "k-123", model: "test-model", timeoutMs: 15000,
};
const input = { partyPreferenceText: "조용한 보드게임", gender: "female", age: 27, occupation: "designer" };
const okBody = (content: string) => ({
  ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }),
});

afterEach(() => { (global.fetch as jest.Mock)?.mockReset?.(); });

describe("OpenAICompatPreferenceAnalyzer", () => {
  it("POSTs OpenAI-shaped request and maps the JSON content to signals", async () => {
    const fetchMock = jest.fn().mockResolvedValue(okBody(JSON.stringify({
      vibe: "calm", activity: ["boardgame"], drinking: "none", pace: "slow", tags: ["quiet"], summary: "s",
    })));
    global.fetch = fetchMock as any;
    const a = new OpenAICompatPreferenceAnalyzer(cfg);
    const out = await a.analyze(input);
    expect(out.vibe).toBe("calm");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://llm.example.com/v1/chat/completions");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer k-123");
    const body = JSON.parse(opts.body);
    expect(body.model).toBe("test-model");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
  });

  it("omits Authorization when no apiKey", async () => {
    const fetchMock = jest.fn().mockResolvedValue(okBody(JSON.stringify({ vibe: "balanced" })));
    global.fetch = fetchMock as any;
    await new OpenAICompatPreferenceAnalyzer({ ...cfg, apiKey: "" }).analyze(input);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("repairs one malformed (non-JSON) response then succeeds", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(okBody("here you go: not json"))
      .mockResolvedValueOnce(okBody(JSON.stringify({ vibe: "energetic" })));
    global.fetch = fetchMock as any;
    const out = await new OpenAICompatPreferenceAnalyzer(cfg).analyze(input);
    expect(out.vibe).toBe("energetic");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws PreferenceAnalysisError on non-2xx", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "err" }) as any;
    await expect(new OpenAICompatPreferenceAnalyzer(cfg).analyze(input)).rejects.toBeInstanceOf(PreferenceAnalysisError);
  });

  it("throws PreferenceAnalysisError when both attempts are unparseable", async () => {
    global.fetch = jest.fn().mockResolvedValue(okBody("still not json")) as any;
    await expect(new OpenAICompatPreferenceAnalyzer(cfg).analyze(input)).rejects.toBeInstanceOf(PreferenceAnalysisError);
  });
});
```
Run: `pnpm --filter @mingle/backend test -- openai-compat` → FAIL.

- [ ] **Step 2: Implement the analyzer**

`apps/backend/src/ai/openai-compat-preference-analyzer.ts`:
```ts
import type { PreferenceSignals } from "@mingle/shared";
import { AnalyzeInput, PreferenceAnalyzer, PreferenceAnalysisError } from "./preference-analyzer.interface";
import { parsePreferenceSignals } from "./preference-signals.schema";

export interface OpenAICompatConfig {
  url: string; chatPath: string; apiKey: string; model: string; timeoutMs: number;
}

const SYSTEM = [
  "You convert a person's free-text party preference into a compact JSON object.",
  "Respond with ONLY a JSON object, no prose, matching exactly this shape:",
  `{"vibe":"calm|energetic|balanced","activity":string[],"drinking":"none|light|social","pace":"slow|medium|fast","tags":string[],"summary":string}`,
  "vibe=overall mood; drinking=alcohol appetite; pace=how fast they want to get close; tags=lowercase keywords for similarity (<=10); summary<=120 chars.",
].join(" ");

function extractJson(content: string): unknown {
  const s = content.indexOf("{"), e = content.lastIndexOf("}");
  if (s === -1 || e === -1 || e < s) throw new Error("no JSON object in content");
  return JSON.parse(content.slice(s, e + 1));
}

export class OpenAICompatPreferenceAnalyzer implements PreferenceAnalyzer {
  constructor(private readonly cfg: OpenAICompatConfig) {}

  async analyze(input: AnalyzeInput): Promise<PreferenceSignals> {
    const user = `Party preference: "${input.partyPreferenceText}"\nGender: ${input.gender}, Age: ${input.age}, Occupation: ${input.occupation}`;
    const messages = [{ role: "system", content: SYSTEM }, { role: "user", content: user }];
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      let content: string;
      try {
        content = await this.call(attempt === 0 ? messages
          : [...messages, { role: "user", content: "Your previous reply was not valid JSON. Reply with ONLY the JSON object." }]);
      } catch (e) {
        throw new PreferenceAnalysisError("LLM request failed", e); // network/non-2xx: no repair
      }
      try {
        return parsePreferenceSignals(extractJson(content));
      } catch (e) { lastErr = e; } // parse/shape failure → repair retry
    }
    throw new PreferenceAnalysisError("LLM output could not be parsed after repair", lastErr);
  }

  private async call(messages: Array<{ role: string; content: string }>): Promise<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cfg.apiKey) headers.Authorization = `Bearer ${this.cfg.apiKey}`;
    const res = await fetch(`${this.cfg.url}${this.cfg.chatPath}`, {
      method: "POST", headers,
      body: JSON.stringify({ model: this.cfg.model, temperature: 0, response_format: { type: "json_object" }, messages }),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty LLM content");
    return content;
  }
}
```
Note: the non-2xx test throws inside `call` → wrapped as `PreferenceAnalysisError` immediately (no repair), matching the test. The unparseable-content case returns content but `extractJson`/`parse` throws → repair loop → final `PreferenceAnalysisError`.

Run: `pnpm --filter @mingle/backend test -- openai-compat` → PASS (all 5).

- [ ] **Step 3: AiModule with env-based provider selection**

`apps/backend/src/ai/ai.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PREFERENCE_ANALYZER } from "./preference-analyzer.interface";
import { StubPreferenceAnalyzer } from "./stub-preference-analyzer";
import { OpenAICompatPreferenceAnalyzer } from "./openai-compat-preference-analyzer";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PREFERENCE_ANALYZER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("LLM_API_URL");
        if (!url) return new StubPreferenceAnalyzer();
        return new OpenAICompatPreferenceAnalyzer({
          url,
          chatPath: config.get<string>("LLM_CHAT_PATH") ?? "/v1/chat/completions",
          apiKey: config.get<string>("LLM_API_KEY") ?? "",
          model: config.get<string>("LLM_MODEL") ?? "gpt-4o-mini",
          timeoutMs: Number(config.get<string>("LLM_TIMEOUT_MS") ?? "15000"),
        });
      },
    },
  ],
  exports: [PREFERENCE_ANALYZER],
})
export class AiModule {}
```

- [ ] **Step 4: Document env**

Append to `apps/backend/.env.example`:
```
# AI preference analysis (self-served, OpenAI-compatible). Unset LLM_API_URL → deterministic stub.
LLM_API_URL=
LLM_CHAT_PATH=/v1/chat/completions
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_MS=15000
```

- [ ] **Step 5: Build + commit**

Run: `pnpm --filter @mingle/backend build` → clean; `pnpm --filter @mingle/backend test` → all pass.
```bash
git add apps/backend/src/ai apps/backend/.env.example
git commit -m "feat(backend): OpenAI-compatible LLM preference analyzer + AiModule (env-selected)"
```

---

## Task 4: Wire analyzer into ProfileService + endpoints + DTO fixes (TDD) → full backend green

**Files:**
- Modify: `apps/backend/src/profile/profile.service.ts`, `profile.controller.ts`, `profile.module.ts`, `dto/create-profile.dto.ts`, `dto/update-profile.dto.ts`, `profile.service.spec.ts`

**Interfaces:**
- Consumes: `PREFERENCE_ANALYZER`, `PreferenceAnalyzer`, `PreferenceAnalysisError`, `AiModule` (Task 3).
- Produces: analyzer-integrated `ProfileService.create/update/reanalyze`; `GET /profiles/me`; `POST /profiles/me/reanalyze`.

- [ ] **Step 1: Write the failing service tests**

Append to `apps/backend/src/profile/profile.service.spec.ts` (adapt to the file's existing setup — it currently constructs `ProfileService` with a Prisma mock; add an analyzer mock arg):
```ts
import { ConflictException } from "@nestjs/common";
import { PreferenceAnalysisError } from "../ai/preference-analyzer.interface";

describe("ProfileService (analyzer integration)", () => {
  const signals = { vibe: "calm", activity: ["boardgame"], drinking: "none", pace: "slow", tags: ["quiet"], summary: "s" };
  const baseDto = { name: "A", age: 27, gender: "female", occupation: "designer", partyPreferenceText: "조용한 보드게임" } as any;
  function make(analyzer: any, profileOverrides: any = {}) {
    const created = { id: "p1", userId: "u1", preferenceSignals: null, ...baseDto, ...profileOverrides };
    const prisma = {
      profile: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn().mockImplementation(({ data }) => ({ ...created, ...data })),
      },
    };
    return { service: new ProfileService(prisma as any, analyzer), prisma };
  }

  it("create runs the analyzer and stores signals", async () => {
    const analyzer = { analyze: jest.fn().mockResolvedValue(signals) };
    const { service, prisma } = make(analyzer);
    const out = await service.create("u1", baseDto);
    expect(analyzer.analyze).toHaveBeenCalledWith(expect.objectContaining({ partyPreferenceText: "조용한 보드게임", occupation: "designer" }));
    expect(prisma.profile.update).toHaveBeenCalledWith(expect.objectContaining({ data: { preferenceSignals: signals } }));
    expect(out.preferenceSignals).toEqual(signals);
  });

  it("create falls back to null signals when the analyzer throws", async () => {
    const analyzer = { analyze: jest.fn().mockRejectedValue(new PreferenceAnalysisError("boom")) };
    const { service, prisma } = make(analyzer);
    const out = await service.create("u1", baseDto);
    expect(prisma.profile.create).toHaveBeenCalled();
    expect(out.preferenceSignals).toBeNull();
  });

  it("create throws ConflictException when a profile already exists", async () => {
    const analyzer = { analyze: jest.fn() };
    const { service, prisma } = make(analyzer);
    prisma.profile.findUnique.mockResolvedValue({ id: "existing" });
    await expect(service.create("u1", baseDto)).rejects.toBeInstanceOf(ConflictException);
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });
});
```
Run: `pnpm --filter @mingle/backend test -- profile.service` → FAIL (constructor arity / ConflictException).

- [ ] **Step 2: Update ProfileService**

In `profile.service.ts`: inject the analyzer, change duplicate → `ConflictException`, create-then-analyze-then-update with fallback, add `reanalyze`. Replace the constructor + `create` and add methods:
```ts
import { Injectable, NotFoundException, ForbiddenException, ConflictException, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { PREFERENCE_ANALYZER, PreferenceAnalyzer, PreferenceAnalysisError } from "../ai/preference-analyzer.interface";
// ...
constructor(
  private prisma: PrismaService,
  @Inject(PREFERENCE_ANALYZER) private analyzer: PreferenceAnalyzer,
) {}

async create(userId: string, dto: CreateProfileDto) {
  const existing = await this.prisma.profile.findUnique({ where: { userId } });
  if (existing) throw new ConflictException("이미 프로필이 존재합니다");
  const profile = await this.prisma.profile.create({
    data: {
      userId, name: dto.name, age: dto.age, gender: dto.gender, occupation: dto.occupation,
      partyPreferenceText: dto.partyPreferenceText, bio: dto.bio, location: dto.location,
      photoUrl: dto.photoUrl, interests: (dto.interests as object) ?? undefined,
      preferenceSignals: undefined, // server-owned
    },
  });
  return this.runAnalysis(profile, dto);
}

private async runAnalysis(profile: { id: string } & Record<string, any>, src: { partyPreferenceText: string; gender: string; age: number; occupation: string }) {
  try {
    const signals = await this.analyzer.analyze({
      partyPreferenceText: src.partyPreferenceText, gender: src.gender, age: src.age, occupation: src.occupation,
    });
    return this.prisma.profile.update({ where: { id: profile.id }, data: { preferenceSignals: signals as object } });
  } catch (e) {
    if (!(e instanceof PreferenceAnalysisError)) throw e;
    console.warn(`[preference] analysis failed for profile ${profile.id}:`, (e as Error).message);
    return profile;
  }
}

async reanalyze(userId: string) {
  const profile = await this.prisma.profile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundException("프로필이 없습니다");
  return this.runAnalysis(profile, profile as any);
}
```
In `update(...)`: after applying the update, if `dto.partyPreferenceText` was provided, call `this.runAnalysis(updated, updated)` and return its result. (Keep existing ownership checks.)

Run: `pnpm --filter @mingle/backend test -- profile.service` → PASS.

- [ ] **Step 3: DTO fixes**

- `dto/create-profile.dto.ts`: remove the `preferenceSignals` field entirely.
- `dto/update-profile.dto.ts`: ensure `occupation` has `@IsNotEmpty()` (with `@IsOptional()` it applies only when present):
```ts
@IsOptional()
@IsString()
@IsNotEmpty()
occupation?: string;
```
(import `IsNotEmpty` from `class-validator`.)

- [ ] **Step 4: Controller endpoints**

In `profile.controller.ts` add (using the existing `@CurrentUser()`/`JwtPayload` pattern):
```ts
@Get("me")
async me(@CurrentUser() user: JwtPayload) {
  const p = await this.profileService.findByUserId(user.userId);
  if (!p) throw new NotFoundException("프로필이 없습니다");
  return p;
}

@Post("me/reanalyze")
reanalyze(@CurrentUser() user: JwtPayload) {
  return this.profileService.reanalyze(user.userId);
}
```
(Place `@Get("me")` BEFORE `@Get(":id")` so "me" isn't captured as an id. Import `NotFoundException`.)

- [ ] **Step 5: Module wiring**

In `profile.module.ts` add `AiModule` to `imports`.

- [ ] **Step 6: Full backend green + boot**

```bash
pnpm --filter @mingle/backend build      # ANSI-safe: 0 errors
pnpm --filter @mingle/backend test       # all pass
docker compose up -d
node -e "require('child_process').execSync('node dist/main.js',{cwd:'apps/backend',timeout:8000,stdio:'inherit'})" 2>&1 | head -25 || true
```
Expected: build clean; jest green; boot logs show AiModule initialized + "Nest application successfully started".

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/profile
git commit -m "feat(backend): analyzer-integrated profile create/update, /profiles/me + reanalyze, DTO fixes"
```

---

## Task 5: `@mingle/client-core` — profiles API module

**Files:**
- Create: `packages/client-core/src/api/profiles.ts`, `packages/client-core/src/api/profiles.spec.ts`
- Modify: `packages/client-core/src/index.ts`

**Interfaces:**
- Consumes: `apiFetch` (existing), `@mingle/shared` types (`Profile`, `PreferenceSignals`).
- Produces: `getMyProfile(): Promise<Profile | null>`, `createProfile(input): Promise<Profile>`.

- [ ] **Step 1: Write the failing test** (mirror the existing `auth.spec.ts` style — stub `apiFetch`/`fetch`):
```ts
import { getMyProfile, createProfile } from "./profiles";
import { configureClient, setTokenAccessor } from "../config";

describe("profiles api", () => {
  beforeEach(() => { configureClient({ baseUrl: "http://x" }); setTokenAccessor(() => "t"); });
  afterEach(() => { (global.fetch as jest.Mock)?.mockReset?.(); });

  it("getMyProfile returns null on 404", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }) as any;
    expect(await getMyProfile()).toBeNull();
  });

  it("createProfile POSTs to /profiles and returns the profile", async () => {
    const profile = { id: "p1", partyPreferenceText: "x" };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201, json: async () => profile }) as any;
    const out = await createProfile({ name: "A", age: 27, gender: "female", occupation: "d", partyPreferenceText: "x" });
    expect(out).toEqual(profile);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toBe("http://x/profiles");
    expect(opts.method).toBe("POST");
  });
});
```
(Note: check whether client-core uses Vitest — if so use `vi` instead of `jest`; follow `auth.spec.ts`.)
Run its test command → FAIL.

- [ ] **Step 2: Implement**

`packages/client-core/src/api/profiles.ts`:
```ts
import type { Profile } from "@mingle/shared";
import { apiFetch, ApiError } from "./client";

export interface CreateProfileInput {
  name: string; age: number; gender: string; occupation: string; partyPreferenceText: string;
  bio?: string; location?: string; photoUrl?: string; interests?: unknown;
}

export async function getMyProfile(): Promise<Profile | null> {
  try {
    return await apiFetch<Profile>("/profiles/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function createProfile(input: CreateProfileInput): Promise<Profile> {
  return apiFetch<Profile>("/profiles", { method: "POST", body: JSON.stringify(input) });
}
```
Export both from `packages/client-core/src/index.ts`.
Run test → PASS; build client-core.

- [ ] **Step 3: Commit**

```bash
git add packages/client-core
git commit -m "feat(client-core): profiles API (getMyProfile, createProfile)"
```

---

## Task 6: Mobile onboarding — profile gate + form

**Files:**
- Create: `apps/mobile/app/onboarding.tsx`
- Modify: `apps/mobile/app/(app)/_layout.tsx` (gate), `apps/mobile/src/lib/*` as needed

**Interfaces:**
- Consumes: `getMyProfile`, `createProfile` (Task 5); existing `useAuthStore`, `apiFetch` wiring.
- Produces: onboarding route + gate.

- [ ] **Step 1: Profile gate in the authed layout**

In `apps/mobile/app/(app)/_layout.tsx`, after the existing auth/hydration gate, fetch the profile once and redirect if absent:
```tsx
// pseudo — adapt to the existing layout's hooks/patterns
const [profileState, setProfileState] = useState<"loading" | "none" | "ok">("loading");
useEffect(() => {
  let alive = true;
  getMyProfile().then((p) => alive && setProfileState(p ? "ok" : "none")).catch(() => alive && setProfileState("none"));
  return () => { alive = false; };
}, []);
if (profileState === "loading") return <LoadingView />;
if (profileState === "none") return <Redirect href="/onboarding" />;
```

- [ ] **Step 2: Onboarding screen**

`apps/mobile/app/onboarding.tsx`: a single scrollable form with gender (segmented male/female/other), age (numeric TextInput), occupation (TextInput), partyPreferenceText (multiline TextInput with example placeholder). Client-side validation (all required; age 18–99; partyPreferenceText ≥ 8 chars). On submit: set a full-screen "선호 분석 중…" loading state, call `createProfile({...})`, then `router.replace("/(app)/home")`. If the returned profile's `preferenceSignals` is null, still navigate and show a brief note "선호 분석은 곧 반영됩니다". Show `ApiError.message` on failure. Follow the visual/style conventions of the existing `register.tsx`.

- [ ] **Step 3: Verify**

```bash
pnpm --filter mingleai exec tsc --noEmit    # or the app's typecheck script; expect clean
```
Then a web smoke run (Phase 0 method): start the Expo web build, confirm register → onboarding routing renders and the form validates (no console errors). Backend must be running with `LLM_API_URL` unset (stub) or set.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): onboarding form + profile gate (routes profile-less users to onboarding)"
```

---

## Self-Review

**Spec coverage:** §3 PreferenceSignals→Task 1; §4.1-4.4 analyzer/interface/stub/openai/module→Tasks 2-3; §4.5-4.6 ProfileService+DTO+endpoints→Task 4; §5 mobile onboarding+gate→Task 6; §6 env→Task 3 Step 4; §7 resilience→Tasks 3-4; §8 tests→every task's TDD; §9 rollup #1/#2→Task 4. `@mingle/client-core` profiles api (§5/§10)→Task 5. ✅

**Placeholder scan:** Concrete code/tests in every code step. Task 6's mobile UI is described (not code-complete) because it follows the existing `register.tsx` pattern and RN form conventions — the deliverable is a form + gate, verified by tsc + web smoke. ✅

**Type consistency:** `PreferenceSignals` shape identical in shared (Task 1), zod schema (Task 2), analyzer (Task 3), service (Task 4). `PREFERENCE_ANALYZER` token + `PreferenceAnalyzer`/`AnalyzeInput`/`PreferenceAnalysisError` names consistent across Tasks 2-4. `getMyProfile`/`createProfile` consistent Tasks 5-6. ✅

**Risks:** LLM tasks are fully testable without a real endpoint (fetch mock + stub). Backend never depends on a live LLM to boot/build (env-selected stub). Boot needs Postgres (up). No new migration. `apps/mobile` tsc script name may differ — Task 6 Step 3 says "or the app's typecheck script".
