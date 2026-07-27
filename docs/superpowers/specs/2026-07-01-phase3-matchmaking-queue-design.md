# Phase 3 — Matchmaking Queue + Party Formation (Design)

> Status: CONFIRMED (co-designed 2026-07-01). Maps to master plan `docs/DEVELOPMENT_PLAN.md`
> §3.3 (즉석 매칭형 큐) + §3.2 (AI 매칭 엔진 — 큐 실시간 수행) + §5.3.1 (매칭 큐 서비스).
> SDD-phase numbering: this is "Phase 3" (Phase 0 = client-core+mobile scaffold, Phase 1 = data
> model v2, Phase 2 = onboarding+AI preference analysis). Builds on the v2 backend + Phase 2
> onboarding (branch `megahuni`, HEAD `964dbb1`).

## 1. Goal & Scope

A user taps **"매칭 시작"** and enters a matchmaking **queue**. A background sweep groups
waiting users by **preference similarity** (their `preferenceSignals` from Phase 2); when a
compatible group of at least the minimum size is found, it **creates a `Party` and starts it
immediately**, moving those users out of the queue. The mobile client shows a waiting screen
(elapsed time, cancel) and, on match, navigates to a party placeholder that lists the participants.

**In scope:** queue enqueue/cancel/status (backend) · preference-similarity grouping + party
formation (background sweep) · matchmaking REST API · `@mingle/client-core` matchmaking API ·
mobile matching UX (start → waiting → matched/failed) · polling-based match notification.

**Out of scope (later phases):** the 2D top-down party space (RN Skia), the realtime Socket.IO
gateway, in-party chat, icebreaker minigames, propose → match → messenger, restaurant reservation.
These consume the `Party`/`PartyParticipant` rows this phase produces but are their own subsystems.

## 2. Key decisions (from brainstorming)

1. **Scope** = queue + party **formation** only; what happens *inside* a party is deferred.
2. **Grouping** = a weighted **similarity score** over `preferenceSignals`, with a **relaxing
   threshold** that loosens the longer a user waits (so sparse queues still match).
3. **Formation trigger** = a **periodic sweep worker** (single mechanism), not on-enqueue — it
   handles formation, threshold relaxation, and timeout uniformly.
4. **Party size** = **min 4 / max 8**, both **env-configurable** (tune fill-rate without redeploy).
5. **Timeout** = when a user exceeds `MATCH_MAX_WAIT_MS` unmatched (queue too sparse), their entry
   is **cancelled** and the client shows a retry prompt.
6. **Gender/age balance** = **deferred**; the score function signature leaves a hook to add it later.
7. **Match notification** = **polling** (`GET /matchmaking/status`); no realtime gateway this phase.

## 3. Data model — reuse existing models, **no migration**

Phase 1 already scaffolded every table this phase needs. No schema change is required.

**`MatchmakingQueueEntry`** (`apps/backend/prisma/schema.prisma`) — used as-is:
```prisma
model MatchmakingQueueEntry {
  id                 String   @id @default(uuid())
  profileId          String   @map("profile_id")
  status             String   @default("waiting") // waiting | matched | cancelled
  preferenceSnapshot Json     @map("preference_snapshot") // signals captured at enqueue time
  matchedPartyId     String?  @map("matched_party_id")
  enqueuedAt         DateTime @default(now()) @map("enqueued_at")
  updatedAt          DateTime @updatedAt @map("updated_at")
  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  @@index([status])
  @@index([profileId])
  @@map("matchmaking_queue_entries")
}
```
- There is **no DB unique on `profileId`**. "At most one *active* (`waiting`) entry per profile" is
  enforced in **service logic inside a transaction** (§7), not by the schema.
- `preferenceSnapshot` stores a copy of the profile's `preferenceSignals` at enqueue time, so a live
  profile edit mid-queue does not change how the user is matched in the current session.

**`Party`** (`status` `matching | active | ended`, `maxParticipants` default 8) and
**`PartyParticipant`** (composite PK `[partyId, profileId]`) — used as-is. Queue-formed parties are
created with `status = "active"`, `startedAt = now`, `name` = a generated label (e.g. `"파티 " +
short-id`), `maxParticipants = MAX_PARTY_SIZE`.

**`Profile.preferenceSignals`** (`Json?`) — the matching input; a `null` value means "not analyzed",
which **blocks queue entry** (§5) until the user (re)analyzes.

## 4. Similarity scoring — pure function in `@mingle/shared`

A platform-agnostic, deterministic, unit-tested function (no I/O), so both the sweep and future
tuning share one definition.

```ts
// packages/shared/src/matchmaking/score.ts
export interface ScoreWeights {
  vibe: number; drinking: number; pace: number; activity: number; tags: number;
}
export const DEFAULT_WEIGHTS: ScoreWeights = { vibe: 3, drinking: 2, pace: 2, activity: 1, tags: 1 };

// Returns a normalized similarity in [0, 1].
export function preferenceScore(
  a: PreferenceSignals,
  b: PreferenceSignals,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number;
```
- Enum agreement (`vibe`/`drinking`/`pace`) contributes its weight when equal, 0 otherwise.
- List overlap (`activity`, `tags`) contributes `weight × min(|intersection|, CAP)` with `CAP = 3`
  (lists are already lowercased + capped at 10 by Phase 2's `normalizeList`).
- The raw weighted sum is divided by the maximum achievable sum (`vibe + drinking + pace +
  activity·CAP + tags·CAP`) to normalize to `[0, 1]`.
- **Balance hook (deferred):** the `ScoreWeights`/signature is the extension point where a future
  gender-ratio / age-band term is added; v1 does not compute it.

## 5. Backend architecture — `matchmaking` module

Fills in the empty Phase-1 `MatchmakingService` skeleton and adds a controller, DTOs, a sweep
worker, and public-projection types. `MatchmakingModule` imports `PrismaModule` (+ `ScheduleModule`).

### 5.1 REST API (all under `JwtAuthGuard`, bound to the caller's profile — no IDOR)

- **`POST /matchmaking/queue`** — enqueue the caller.
  - Loads the caller's profile; if it has no profile → **404**; if `preferenceSignals` is `null` →
    **400** `"선호 분석이 필요합니다"` (client routes to reanalyze).
  - **Idempotent:** if an active (`waiting`) entry already exists, return it (no duplicate).
  - Otherwise create an entry with `preferenceSnapshot = profile.preferenceSignals`. Returns the
    entry (`{ id, status, enqueuedAt }`).
- **`DELETE /matchmaking/queue`** — cancel the caller's `waiting` entry (→ `cancelled`); **404** if
  none is active.
- **`GET /matchmaking/status`** — the caller's current queue state, for polling:
  ```ts
  {
    status: "none" | "waiting" | "matched" | "cancelled";
    elapsedMs?: number;           // present while waiting
    estimatedWaitMs?: number;     // coarse estimate while waiting
    matchedPartyId?: string;      // present when matched
    party?: PublicParty;          // present when matched (participant list, projected)
  }
  ```

### 5.2 Public projection (resolves Phase-2's deferred peer-exposure item)

When `status` returns a matched party, participants are returned as a **public profile projection** —
**never** the internal `riskScore` and **never** the raw `preferenceSignals`; only a human-readable
`summary` is surfaced:
```ts
// packages/shared/src/matchmaking/public-party.ts
export interface PublicPartyParticipant {
  profileId: string; name: string; age: number; gender: string;
  occupation: string; photoUrl?: string; preferenceSummary?: string; // = preferenceSignals.summary
}
export interface PublicParty {
  id: string; name: string; status: string; participants: PublicPartyParticipant[];
}
```

### 5.3 Sweep worker

- Scheduler: `@nestjs/schedule` `@Interval(MATCH_SWEEP_MS)` (add the dep + `ScheduleModule.forRoot()`
  in `AppModule`). A re-entrancy guard flag skips a tick if the previous one is still running.
- The core logic is a **pure, timer-free method** `runSweep(now: Date): Promise<SweepResult>` that the
  scheduler calls — tests invoke it directly with controlled `now` and seeded entries.
- Algorithm per tick:
  1. Load all `waiting` entries ordered by `enqueuedAt` (oldest first).
  2. **Timeout pass:** any entry with `now − enqueuedAt > MATCH_MAX_WAIT_MS` → mark `cancelled`
     (status-guarded, §7); drop from the working set.
  3. **Formation pass:** while the working set is non-empty, take the oldest entry as the **anchor**,
     compute `preferenceScore(anchor, other)` for every other entry, and select the top `MAX−1`
     whose score `≥ threshold(anchorElapsed)`. If `1 + selectedCount ≥ MIN`, form a party from
     `{anchor} ∪ selected[0 .. MAX−1]` (§7 transaction) and remove them from the working set;
     otherwise remove just the anchor (it stays `waiting` in the DB for a later tick).
  - **Relaxing threshold:** `threshold(elapsed) = MATCH_BASE_THRESHOLD × max(0, 1 − elapsed /
    MATCH_MAX_WAIT_MS)` — strict early, ~0 near timeout.
  - Grouping is **anchor-centric** (members are similar to the anchor, not necessarily pairwise) —
    an accepted MVP simplification; documented for the plan.

## 6. Mobile (Expo)

- **Entry point:** a **"매칭 시작"** action on `(app)/home` (enabled only when the user has a profile
  with non-null `preferenceSignals`; if signals are missing, prompt to (re)analyze).
- **Waiting screen** (`app/(app)/matching.tsx` or a modal route): `POST /matchmaking/queue`, then a
  "매칭 중" animation with elapsed time and a **취소** button (`DELETE /matchmaking/queue` → home).
  Polls `GET /matchmaking/status` every **~2.5–3 s** (guarded against overlap + unmount).
  - `matched` → navigate to a **party placeholder** (`app/(app)/party/[id].tsx`) listing
    `party.participants` (name / photo / `preferenceSummary`) with "곧 파티가 시작됩니다" — the 2D
    view is a later phase.
  - `cancelled` → "지금은 매칭이 어려워요. 다시 시도해 주세요." + retry.
- **`@mingle/client-core`:** a `matchmaking` API module — `enqueue()`, `cancelQueue()`,
  `getMatchmakingStatus()` — plus the shared `MatchmakingStatus`/`PublicParty` types, mirroring the
  existing `auth`/`profiles` modules (Vitest tests).

## 7. Concurrency, error handling & resilience

- **Single writer:** only the sweep forms parties, and the re-entrancy guard ensures one sweep runs
  at a time within an instance — so no two formations race within a process.
- **Status-guarded claims (optimistic):** every state transition an entry undergoes
  (`waiting → matched`, `waiting → cancelled`) is a `updateMany({ where: { id, status: "waiting" },
  data: {...} })`; a claim that affects 0 rows means another actor already took the entry, so it is
  skipped. This makes an entry claimable **exactly once** even under a race.
- **Party formation is one transaction** (`prisma.$transaction`): create the `Party`, create the
  `PartyParticipant` rows, and status-guard-update every member entry to `matched` +
  `matchedPartyId`. If any guarded update claims 0 rows (a member was concurrently taken), the
  transaction rolls back and the tick moves on.
- **Enqueue dedup:** the existence check + create run in a transaction; a racing duplicate is caught
  and the existing entry is returned (idempotent), never two active entries.
- **Errors:** no profile → 404; `preferenceSignals` null → 400; cancel with no active entry → 404;
  the sweep logs and continues on a per-group failure (one bad group never stalls the queue).
- **Multi-instance (deferred):** running multiple backend instances each with a sweep is safe against
  double-claiming (status-guarded), but a distributed lock (Redis) to run a single global sweep is
  left to the realtime/scaling phase and noted here.

## 8. Configuration (env)

Backend `.env` (+ `.env.example`), all with safe defaults:
```
MIN_PARTY_SIZE=4          # minimum group size to form a party
MAX_PARTY_SIZE=8          # maximum party capacity
MATCH_SWEEP_MS=2500       # sweep interval
MATCH_MAX_WAIT_MS=120000  # max queue wait before an entry is cancelled
MATCH_BASE_THRESHOLD=0.5  # starting similarity threshold (relaxes toward 0 over the wait)
```
Invalid/missing values fall back to these defaults (validated at module construction, per the Phase-2
`LLM_TIMEOUT_MS` hardening pattern).

## 9. Testing (TDD)

- **`@mingle/shared` (Vitest):** `preferenceScore` — enum agreement, list overlap + cap,
  normalization to `[0,1]`, weight application, identical vs disjoint signals.
- **Backend (Jest):** `runSweep(now)` with seeded entries — forms a party at exactly `MIN`, caps at
  `MAX`, respects the relaxing threshold (a pair that fails early passes after enough elapsed time),
  cancels entries past `MATCH_MAX_WAIT_MS`, and (via a mocked/`updateMany`-guarded prisma) claims each
  entry once under a simulated race. `MatchmakingService` — enqueue (no-profile 404, null-signals
  400, idempotent re-enqueue), cancel (404 when none), status projection strips `riskScore` and raw
  `preferenceSignals`. A multi-user "enqueue N → sweep → one party of size in `[MIN, MAX]`" scenario.
- **`@mingle/client-core` (Vitest):** `enqueue`/`cancelQueue`/`getMatchmakingStatus` request shape +
  status mapping.
- **Mobile:** `tsc --noEmit` clean; waiting-screen polling/cancel logic verified by inspection
  (consistent with Phase 2's mobile gate).
- **Green gate:** `@mingle/shared` build; `@mingle/backend` build + jest all pass + boots (sweep
  interval starts, `ScheduleModule` initialized); `@mingle/client-core` tests; `apps/mobile` tsc.

## 10. Boundaries & carry-forward

- Do **not** touch `apps/web` / `@mingle/mingles-mcp` (out of scope, may stay broken).
- Honor the Phase-1 carry-forward when it becomes relevant: **Match** creation (a *later* phase)
  must normalize `(profileId1, profileId2)` ordering — **not** used here (this phase creates
  `Party`/`PartyParticipant`, not `Match`).
- This phase **resolves** the Phase-2 deferred item "peer exposure of `preferenceSignals` in authed
  browse" by defining the **public party projection** (§5.2): riskScore + raw signals are never
  exposed; only `preferenceSummary`.
- Reaffirm the Phase-2 posture: profile reads require `JwtAuthGuard` and omit `riskScore`.
- New deferred items recorded for later phases: realtime match push (Socket.IO), a Redis distributed
  sweep lock for multi-instance, and gender/age balance weighting in `preferenceScore`.

## 11. Deliverables

- `@mingle/shared`: `preferenceScore` + `ScoreWeights`/`DEFAULT_WEIGHTS`; `MatchmakingStatus`,
  `PublicParty`/`PublicPartyParticipant` types.
- Backend: `matchmaking` module — controller (`POST`/`DELETE /matchmaking/queue`,
  `GET /matchmaking/status`), `MatchmakingService` (enqueue/cancel/status + public projection), the
  sweep worker (`runSweep` + `@Interval` scheduler), DTOs, `@nestjs/schedule` dep +
  `ScheduleModule.forRoot()`, `.env.example` matchmaking vars, unit tests.
- `@mingle/client-core`: `matchmaking` API module + types.
- `apps/mobile`: "매칭 시작" entry, waiting screen (poll + cancel), party placeholder screen, client
  wiring.
