# Phase 2 — Onboarding + AI Preference Analysis (Design)

> Status: CONFIRMED (co-designed 2026-07-01). Maps to master plan `docs/DEVELOPMENT_PLAN.md`
> §3.1 (온보딩/가입) + §3.2 (AI 매칭 엔진 — 분석). SDD-phase numbering: this is "Phase 2"
> (Phase 0 = client-core+mobile scaffold, Phase 1 = data model v2). Builds on the v2 backend
> (branch `worktree-mobile-pivot-plan`, HEAD 098153f).

## 1. Goal & Scope

After `register` (email/password, already built), the user completes a **profile onboarding**
(gender · age · occupation + a natural-language party preference). On submit, an **LLM analyzes
the preference into a structured `preferenceSignals` object** and stores it on the Profile. The
signals are the input the *next* phase's matchmaking queue will group on.

**In scope:** onboarding flow (mobile) · profile create/read wiring · AI preference-analysis
pipeline (self-served OpenAI-compatible LLM behind an injectable interface) · synchronous analysis
with resilient fallback · on-demand re-analysis.

**Out of scope (later phases):** matchmaking queue, party rooms, 2D view, minigames, propose/match/
messenger, restaurant reservation, refresh tokens (still deferred), social login, admin mobile.

## 2. Key decisions (from brainstorming)

1. **Scope** = onboarding + AI analysis only (no queue/party this phase).
2. **Engine** = real LLM call with structured output, behind a `PreferenceAnalyzer` interface;
   tests use a deterministic stub (no external calls). Follows the Phase 0 dependency-injection
   pattern (config/storage were injectable; the analyzer is too).
3. **Timing** = synchronous on profile create (onboarding shows a "선호 분석 중…" loading), with a
   resilient fallback: if the LLM fails/times out, the profile is still created with
   `preferenceSignals = null` and onboarding still completes; analysis is retryable on demand.
4. **Wire contract** = **OpenAI-compatible** `POST /v1/chat/completions`. The base URL, endpoint
   path, model, and key are **env-injected** so the user plugs in their self-served endpoint with
   **no code change**.

## 3. `PreferenceSignals` schema

Add to `@mingle/shared` (`packages/shared/src/types/`), replacing the `unknown` typing of
`Profile.preferenceSignals`:

```ts
export type PreferenceVibe = "calm" | "energetic" | "balanced";
export type PreferenceDrinking = "none" | "light" | "social";
export type PreferencePace = "slow" | "medium" | "fast";

export interface PreferenceSignals {
  vibe: PreferenceVibe;        // 분위기
  activity: string[];          // 활동 키워드 e.g. ["boardgame","talking"]
  drinking: PreferenceDrinking;// 음주 성향
  pace: PreferencePace;        // 친해지는 속도
  tags: string[];              // 유사도 계산용 자유 키워드 (소문자, 0-10개)
  summary: string;             // 한 줄 요약 (사람이 읽는 용도, ≤120자)
}
```

The Prisma column stays `Json?` (no migration). Application code treats a present value as
`PreferenceSignals` and `null` as "not analyzed / needs (re)analysis".

## 4. Backend architecture

New module `ai/` (or co-located under `profile/`): the analyzer, its interface, config, and a stub.

### 4.1 `PreferenceAnalyzer` interface
```ts
export interface AnalyzeInput {
  partyPreferenceText: string;
  gender: string;
  age: number;
  occupation: string;
}
export interface PreferenceAnalyzer {
  analyze(input: AnalyzeInput): Promise<PreferenceSignals>; // throws on unrecoverable failure
}
export const PREFERENCE_ANALYZER = Symbol("PREFERENCE_ANALYZER"); // Nest DI token
```

### 4.2 `OpenAICompatPreferenceAnalyzer` (production impl)
- `POST ${LLM_API_URL}${LLM_CHAT_PATH}` via native `fetch` (Node 26). `LLM_CHAT_PATH` default
  `/v1/chat/completions`.
- Headers: `Content-Type: application/json`; `Authorization: Bearer ${LLM_API_KEY}` only when
  `LLM_API_KEY` is set (self-served endpoints may need no key).
- Body:
  ```jsonc
  {
    "model": "<LLM_MODEL>",
    "temperature": 0,
    "response_format": { "type": "json_object" },   // sent opportunistically; ignored by servers that don't support it
    "messages": [
      { "role": "system", "content": "<analysis instructions + the exact JSON schema + rules>" },
      { "role": "user",   "content": "<partyPreferenceText + gender/age/occupation context>" }
    ]
  }
  ```
- Read `choices[0].message.content` → parse JSON → **validate with Zod** against the
  `PreferenceSignals` schema (enums coerced/clamped; `tags`/`activity` lowercased + capped;
  `summary` trimmed to ≤120 chars). On invalid/unparseable output, do **one repair retry** (re-ask
  with the validation error appended). If still invalid → throw `PreferenceAnalysisError`.
- `AbortSignal.timeout(LLM_TIMEOUT_MS ?? 15000)`; non-2xx or timeout → throw
  `PreferenceAnalysisError` (caught by the caller's fallback).
- Add **`zod`** to backend deps for robust untrusted-JSON validation + coercion.

### 4.3 `StubPreferenceAnalyzer` (test/dev impl)
Deterministic mapping from keywords in `partyPreferenceText` to a valid `PreferenceSignals`
(e.g. contains "보드게임"→activity boardgame, "조용"→vibe calm, "술 없"→drinking none). Used by
unit tests and selectable in dev via `LLM_API_URL` unset. No network.

### 4.4 Analyzer module + provider selection
`AiModule` provides `PREFERENCE_ANALYZER`: if `LLM_API_URL` is configured →
`OpenAICompatPreferenceAnalyzer`, else → `StubPreferenceAnalyzer` (keeps local/dev + CI green with
no endpoint). Exports the token; `ProfileModule` imports `AiModule`.

### 4.5 `ProfileService` wiring (synchronous + resilient)
- `create(userId, dto)`:
  1. reject if a profile already exists — throw **`ConflictException`** (409) (fixes Phase 1
     rollup #2; update the existing test accordingly).
  2. create the Profile with `preferenceSignals: null` (ignore any client-supplied
     `preferenceSignals` — server owns it now; drop it from the create DTO).
  3. `try { signals = await analyzer.analyze({...}); update profile.preferenceSignals = signals }
     catch (PreferenceAnalysisError) { log warn; leave null }` — the request still returns the
     created profile (with or without signals). Onboarding never hard-fails on an LLM hiccup.
  4. return the profile.
- `update(id, userId, dto)`: if `partyPreferenceText` changes, re-run analysis (same resilient
  try/catch) and refresh `preferenceSignals`.
- `reanalyze(userId)`: recompute signals for the caller's profile on demand (retry after a failed/
  null analysis). Exposed as `POST /profiles/me/reanalyze`.
- `findByUserId(userId)` already exists → back a **`GET /profiles/me`** returning the caller's
  profile or `404` if none (used by the mobile onboarding gate).

### 4.6 DTO
- `create-profile.dto.ts`: remove `preferenceSignals` (server-owned now). Keep v2 fields;
  `occupation` required with `@IsNotEmpty()`.
- `update-profile.dto.ts`: add `@IsNotEmpty()` to `occupation` (fixes Phase 1 rollup #1).

## 5. Mobile (Expo) onboarding

- **Gate:** after auth (token present), the app checks the caller's profile via `GET /profiles/me`.
  No profile → route to `/onboarding` (block `(app)/home`). Has profile → home. Implemented in the
  authed layout using `apiFetch` + local state (consistent with existing login/register; **no new
  data-layer dep** — TanStack Query deferred).
- **`app/onboarding.tsx`** (single scrollable form, MVP):
  - gender (segmented/select: male/female/other), age (numeric), occupation (text),
    partyPreferenceText (multiline textarea with example placeholder).
  - client-side validation (all required; age numeric within a sane range; partyPreferenceText
    min length).
  - submit → **"선호 분석 중…" full-screen loading** → `POST /profiles` (via `@mingle/client-core`
    api) → on success route to home. If the returned profile has `preferenceSignals === null`
    (LLM fallback), still proceed to home and show a subtle toast "선호 분석은 곧 반영됩니다".
- Add a typed `profiles` API surface to `@mingle/client-core` (`getMyProfile`, `createProfile`)
  mirroring the existing `auth` API module, returning shared types.

## 6. Configuration (env)

Backend `.env` (+ `.env.example`):
```
LLM_API_URL=            # e.g. https://my-served-llm.example.com  (unset → StubPreferenceAnalyzer)
LLM_CHAT_PATH=/v1/chat/completions
LLM_API_KEY=            # optional bearer
LLM_MODEL=              # e.g. gpt-4o-mini / llama-3.1-8b-instruct / whatever the user serves
LLM_TIMEOUT_MS=15000
```
The user supplies `LLM_API_URL`/`LLM_MODEL` (+ optional key) to activate the real analyzer — no
code change.

## 7. Error handling & resilience

- LLM non-2xx / timeout / malformed-after-repair → `PreferenceAnalysisError`; caller logs and
  leaves `preferenceSignals = null` (retryable). Onboarding completes regardless.
- Zod validation coerces/clamps rather than rejecting when safely possible (unknown enum → nearest
  or `balanced`/`medium`; over-long arrays truncated) to maximize usable signals from imperfect
  self-served models; only unparseable JSON triggers the repair retry then hard error.
- Input validation via existing class-validator DTOs.
- Never log the raw API key; log endpoint host + status only.

## 8. Testing (TDD)

- **Backend unit:**
  - `OpenAICompatPreferenceAnalyzer` — `fetch` stubbed to return an OpenAI-shaped response;
    assert request shape (URL/path, auth header presence/absence, body messages+model+
    response_format), response mapping, Zod validation/coercion, the repair-retry path, and
    timeout/non-2xx → `PreferenceAnalysisError`. No real network.
  - `StubPreferenceAnalyzer` — deterministic keyword→signals mapping.
  - `ProfileService` — create calls the analyzer (mock) and stores signals; analyzer throw → profile
    still created with null signals (fallback); duplicate → `ConflictException`; update re-analyzes
    on `partyPreferenceText` change; `reanalyze` recomputes.
  - Provider selection: `LLM_API_URL` set → real impl; unset → stub.
- **Mobile:** `tsc` clean; onboarding form validation logic unit-tested where practical; the
  profile-gate routing verified via an Expo web run (screens render/route), consistent with Phase 0.
- **Green gate:** `@mingle/backend` build 0 errors + jest all pass + boots; `@mingle/shared` builds;
  `@mingle/client-core` tests pass; `apps/mobile` tsc clean.

## 9. Boundaries & carry-forward

- Do NOT touch `apps/web` / `@mingle/mingleai-mcp` (out of scope, may stay broken).
- Honor Phase 1 carry-forward invariants when they become relevant (they mostly land in later
  phases): Match pair-ordering normalization, date-plan matchId guard, dashboard IDOR
  (auth-hardening phase), User→Profile cascade/RESTRICT (account-deletion phase).
- This phase also clears Phase 1 Minor-rollup items #1 (`occupation` `@IsNotEmpty`) and #2
  (duplicate-profile → `ConflictException`) as part of the profile work.

## 10. Deliverables

- `@mingle/shared`: `PreferenceSignals` + enums.
- Backend: `ai/` module (interface, `OpenAICompatPreferenceAnalyzer`, `StubPreferenceAnalyzer`,
  Zod schema, config), `ProfileService`/controller wiring (`GET /profiles/me`,
  `POST /profiles/me/reanalyze`, analyzer-integrated create/update), DTO fixes, `zod` dep,
  `.env.example` LLM vars, unit tests.
- `@mingle/client-core`: `profiles` API module + types.
- `apps/mobile`: onboarding screen + profile gate + client wiring.
