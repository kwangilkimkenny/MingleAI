# Phase 3 — Matchmaking Queue + Party Formation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user enter a matchmaking queue; a background sweep groups waiting users by preference similarity and, at a compatible group of min size, creates and starts a `Party` — surfaced to mobile via polling.

**Architecture:** A pure similarity-scoring function in `@mingle/shared`; a NestJS `matchmaking` module (REST enqueue/cancel/status + a lifecycle-driven sweep that forms parties in one status-guarded transaction); a `@mingle/client-core` API; a mobile waiting screen + party placeholder. Reuses the Phase-1 `MatchmakingQueueEntry`/`Party`/`PartyParticipant` tables — no DB migration.

**Tech Stack:** TypeScript, NestJS 10 + Prisma 6 (Postgres), Jest (backend), `@mingle/shared` + Vitest, React Native + Expo Router (mobile).

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-01-phase3-matchmaking-queue-design.md`. Every task's requirements implicitly include it.
- **No Prisma migration.** Reuse existing `MatchmakingQueueEntry` (status `waiting|matched|cancelled`, `preferenceSnapshot Json`, `matchedPartyId`, `enqueuedAt`), `Party` (status `matching|active|ended`, `maxParticipants`, `name` required, `startedAt`), `PartyParticipant` (composite PK `[partyId, profileId]`). Do NOT run `prisma migrate*` (blocked in this env + not needed).
- **Party size:** min `MIN_PARTY_SIZE` (default 4), max `MAX_PARTY_SIZE` (default 8), env-configurable.
- **Sweep interval** `MATCH_SWEEP_MS` (default 2500), **timeout** `MATCH_MAX_WAIT_MS` (default 120000), **base threshold** `MATCH_BASE_THRESHOLD` (default 0.5). Invalid/missing env → fall back to the default (validate at construction, per the Phase-2 `LLM_TIMEOUT_MS` pattern).
- **Scheduler:** use an `OnModuleInit`/`OnModuleDestroy` `setInterval(() => this.runSweep(new Date()), sweepMs)` (NOT `@nestjs/schedule`) so the interval is env-driven and `runSweep(now)` stays timer-free for tests. A boolean re-entrancy guard skips a tick if the previous is still running.
- **Concurrency:** every queue-entry state transition uses `updateMany({ where: { id, status: "waiting" }, ... })` (status-guarded optimistic claim); party formation runs in one `prisma.$transaction`. The sweep dedupes its working set to **one entry per `profileId`** (oldest) so a user can never be placed in two parties.
- **Public projection:** `GET /matchmaking/status` and any party payload return participants WITHOUT `riskScore` and WITHOUT raw `preferenceSignals` — only `preferenceSummary` (= `preferenceSignals.summary`). All matchmaking endpoints are under `JwtAuthGuard`, bound to the caller's profile.
- **ANSI-safe TS error check:** `pnpm --filter @mingle/backend build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error"` (grep for "error TS" alone falsely returns 0 due to ANSI codes).
- `@mingle/client-core` uses **Vitest** (tests in `src/__tests__/*.test.ts`, use `vi` not `jest`). `@mingle/shared` uses **Vitest**. Backend uses **Jest**.
- Do NOT touch `apps/web` / `@mingle/mingles-mcp`.

---

### Task 1: `@mingle/shared` — similarity score + matchmaking types

**Files:**
- Create: `packages/shared/src/matchmaking/score.ts`
- Create: `packages/shared/src/matchmaking/types.ts`
- Create: `packages/shared/src/matchmaking/score.test.ts`
- Modify: `packages/shared/src/index.ts` (add barrel exports)

**Interfaces:**
- Consumes: `PreferenceSignals` from `../types/preference.js` (`{ vibe, activity, drinking, pace, tags, summary }`).
- Produces: `preferenceScore(a, b, weights?) => number` in `[0,1]`; `ScoreWeights`, `DEFAULT_WEIGHTS`; types `MatchmakingQueueEntry`, `MatchmakingQueueStatus`, `MatchmakingStatus`, `PublicParty`, `PublicPartyParticipant`.

- [ ] **Step 1: Write the failing test** — `packages/shared/src/matchmaking/score.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { preferenceScore, DEFAULT_WEIGHTS } from "./score.js";
import type { PreferenceSignals } from "../types/preference.js";

const base: PreferenceSignals = {
  vibe: "calm", drinking: "light", pace: "slow",
  activity: ["boardgame"], tags: ["quiet"], summary: "x",
};

describe("preferenceScore", () => {
  it("returns 1 for identical enums + full list overlap", () => {
    expect(preferenceScore(base, base)).toBeCloseTo(1, 5);
  });
  it("returns 0 when nothing matches", () => {
    const other: PreferenceSignals = {
      vibe: "energetic", drinking: "social", pace: "fast",
      activity: ["clubbing"], tags: ["loud"], summary: "y",
    };
    expect(preferenceScore(base, other)).toBe(0);
  });
  it("weights enum agreement and list overlap, normalized to [0,1]", () => {
    const partial: PreferenceSignals = { ...base, drinking: "social", pace: "fast", tags: ["noisy"] };
    const s = preferenceScore(base, partial); // vibe(3) + activity overlap 1*1 = 4 of 13
    expect(s).toBeCloseTo(4 / 13, 5);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
  it("caps list overlap contribution at 3 and tolerates missing arrays", () => {
    const a: PreferenceSignals = { ...base, activity: ["a","b","c","d","e"], tags: [] };
    const b: PreferenceSignals = { ...base, activity: ["a","b","c","d","e"], tags: [] };
    // identical vibe/drinking/pace(7) + activity capped 1*3 + tags overlap 0 => 10/13
    expect(preferenceScore(a, b)).toBeCloseTo(10 / 13, 5);
    // missing arrays must not throw
    const bad = { vibe: "calm", drinking: "light", pace: "slow" } as unknown as PreferenceSignals;
    expect(() => preferenceScore(bad, bad)).not.toThrow();
  });
  it("DEFAULT_WEIGHTS are vibe3/drinking2/pace2/activity1/tags1", () => {
    expect(DEFAULT_WEIGHTS).toEqual({ vibe: 3, drinking: 2, pace: 2, activity: 1, tags: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/shared exec vitest run src/matchmaking/score.test.ts`
Expected: FAIL (cannot resolve `./score.js`).

- [ ] **Step 3: Write minimal implementation** — `packages/shared/src/matchmaking/score.ts`

```ts
import type { PreferenceSignals } from "../types/preference.js";

export interface ScoreWeights {
  vibe: number;
  drinking: number;
  pace: number;
  activity: number;
  tags: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  vibe: 3,
  drinking: 2,
  pace: 2,
  activity: 1,
  tags: 1,
};

const OVERLAP_CAP = 3;

function overlapCount(x?: string[], y?: string[]): number {
  const a = new Set(x ?? []);
  let n = 0;
  for (const t of new Set(y ?? [])) if (a.has(t)) n++;
  return n;
}

/** Normalized preference similarity in [0, 1]. Deterministic, no I/O. */
export function preferenceScore(
  a: PreferenceSignals,
  b: PreferenceSignals,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number {
  let raw = 0;
  if (a.vibe === b.vibe) raw += weights.vibe;
  if (a.drinking === b.drinking) raw += weights.drinking;
  if (a.pace === b.pace) raw += weights.pace;
  raw += weights.activity * Math.min(overlapCount(a.activity, b.activity), OVERLAP_CAP);
  raw += weights.tags * Math.min(overlapCount(a.tags, b.tags), OVERLAP_CAP);

  const max =
    weights.vibe +
    weights.drinking +
    weights.pace +
    weights.activity * OVERLAP_CAP +
    weights.tags * OVERLAP_CAP;
  return max === 0 ? 0 : raw / max;
}
```

- [ ] **Step 4: Create the types file** — `packages/shared/src/matchmaking/types.ts`

```ts
export type MatchmakingQueueStatus = "none" | "waiting" | "matched" | "cancelled";

export interface MatchmakingQueueEntry {
  id: string;
  status: "waiting" | "matched" | "cancelled";
  enqueuedAt: string;
  matchedPartyId?: string | null;
}

export interface PublicPartyParticipant {
  profileId: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  photoUrl?: string;
  preferenceSummary?: string;
}

export interface PublicParty {
  id: string;
  name: string;
  status: string;
  participants: PublicPartyParticipant[];
}

export interface MatchmakingStatus {
  status: MatchmakingQueueStatus;
  elapsedMs?: number;
  matchedPartyId?: string;
  party?: PublicParty;
}
```

- [ ] **Step 5: Add barrel exports** — append to `packages/shared/src/index.ts` (follow the existing `export ... from "./<path>.js"` convention)

```ts
export { preferenceScore, DEFAULT_WEIGHTS } from "./matchmaking/score.js";
export type { ScoreWeights } from "./matchmaking/score.js";
export type {
  MatchmakingQueueStatus,
  MatchmakingQueueEntry,
  PublicPartyParticipant,
  PublicParty,
  MatchmakingStatus,
} from "./matchmaking/types.js";
```

- [ ] **Step 6: Run tests + build to verify they pass**

Run: `pnpm --filter @mingle/shared exec vitest run src/matchmaking/score.test.ts && pnpm --filter @mingle/shared build`
Expected: tests PASS; `tsc` exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/matchmaking packages/shared/src/index.ts
git commit -m "feat(shared): preferenceScore + matchmaking queue/party types"
```

---

### Task 2: Backend — matchmaking service (enqueue / cancel / status) + REST API

**Files:**
- Create: `apps/backend/src/matchmaking/matchmaking.service.ts`
- Create: `apps/backend/src/matchmaking/matchmaking.controller.ts`
- Create: `apps/backend/src/matchmaking/matchmaking.service.spec.ts`
- Modify: `apps/backend/src/matchmaking/matchmaking.module.ts` (add controller + exports)
- Modify: `apps/backend/src/app.module.ts` (MatchmakingModule already imported in Phase 1 — verify; no change if present)

**Interfaces:**
- Consumes: `PrismaService` (`apps/backend/src/prisma/prisma.service.ts`); `JwtAuthGuard` + `@CurrentUser()` / `JwtPayload` (find them under `apps/backend/src/auth/` — the same ones `profile.controller.ts` imports); shared `MatchmakingStatus`, `PublicParty` types.
- Produces: `MatchmakingService.enqueue(userId)`, `.cancel(userId)`, `.getStatus(userId)`; routes `POST /matchmaking/queue`, `DELETE /matchmaking/queue`, `GET /matchmaking/status`. `MatchmakingService` also exposes `loadPublicParty(partyId)` reused by Task 3's tests.

Before writing, open `apps/backend/src/profile/profile.controller.ts` to copy the exact `JwtAuthGuard`/`@CurrentUser()`/`JwtPayload` import paths and the `user.userId` access pattern.

- [ ] **Step 1: Write the failing test** — `apps/backend/src/matchmaking/matchmaking.service.spec.ts`

```ts
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { MatchmakingService } from "./matchmaking.service";

const signals = { vibe: "calm", drinking: "light", pace: "slow", activity: ["boardgame"], tags: ["quiet"], summary: "조용" };

function makePrisma(overrides: any = {}) {
  return {
    profile: { findUnique: jest.fn() },
    matchmakingQueueEntry: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    party: { findUnique: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(txOf(overrides))),
    ...overrides,
  } as any;
}
function txOf(o: any) {
  return {
    matchmakingQueueEntry: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "e1", status: "waiting", enqueuedAt: new Date("2026-07-01T00:00:00Z"), matchedPartyId: null }) },
    ...(o.tx ?? {}),
  };
}

describe("MatchmakingService", () => {
  it("enqueue → 404 when the caller has no profile", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue(null);
    const svc = new MatchmakingService(prisma);
    await expect(svc.enqueue("u1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("enqueue → 400 when preferenceSignals is null", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1", preferenceSignals: null });
    const svc = new MatchmakingService(prisma);
    await expect(svc.enqueue("u1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("enqueue → creates a waiting entry snapshotting the signals", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1", preferenceSignals: signals });
    const created = { id: "e1", status: "waiting", enqueuedAt: new Date(), matchedPartyId: null };
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({ matchmakingQueueEntry: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) } }));
    const svc = new MatchmakingService(prisma);
    const res = await svc.enqueue("u1");
    expect(res.status).toBe("waiting");
    expect(res.id).toBe("e1");
  });

  it("enqueue → idempotent: returns the existing waiting entry", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1", preferenceSignals: signals });
    const existing = { id: "eX", status: "waiting", enqueuedAt: new Date(), matchedPartyId: null };
    const createSpy = jest.fn();
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({ matchmakingQueueEntry: { findFirst: jest.fn().mockResolvedValue(existing), create: createSpy } }));
    const svc = new MatchmakingService(prisma);
    const res = await svc.enqueue("u1");
    expect(res.id).toBe("eX");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("cancel → 404 when there is no active entry", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1" });
    prisma.matchmakingQueueEntry.updateMany.mockResolvedValue({ count: 0 });
    const svc = new MatchmakingService(prisma);
    await expect(svc.cancel("u1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("getStatus → matched returns a public party without riskScore or raw signals", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1" });
    prisma.matchmakingQueueEntry.findFirst = jest.fn().mockResolvedValue({ status: "matched", matchedPartyId: "party1", enqueuedAt: new Date() });
    prisma.party.findUnique.mockResolvedValue({
      id: "party1", name: "파티", status: "active",
      participants: [{ profile: { id: "p1", name: "A", age: 27, gender: "non_binary", occupation: "dev", photoUrl: null, riskScore: 0, preferenceSignals: { summary: "조용" } } }],
    });
    const svc = new MatchmakingService(prisma);
    const res = await svc.getStatus("u1");
    expect(res.status).toBe("matched");
    const p = res.party!.participants[0] as any;
    expect(p.preferenceSummary).toBe("조용");
    expect(p.riskScore).toBeUndefined();
    expect(p.preferenceSignals).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/backend exec jest matchmaking.service`
Expected: FAIL (cannot find `./matchmaking.service`).

- [ ] **Step 3: Write the service** — `apps/backend/src/matchmaking/matchmaking.service.ts`

```ts
import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { MatchmakingQueueEntry, MatchmakingStatus, PublicParty } from "@mingle/shared";

@Injectable()
export class MatchmakingService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(userId: string): Promise<MatchmakingQueueEntry> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException("프로필이 없습니다");
    if (!profile.preferenceSignals) throw new BadRequestException("선호 분석이 필요합니다");

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.matchmakingQueueEntry.findFirst({
        where: { profileId: profile.id, status: "waiting" },
      });
      if (existing) return this.toEntry(existing);
      const entry = await tx.matchmakingQueueEntry.create({
        data: {
          profileId: profile.id,
          status: "waiting",
          preferenceSnapshot: profile.preferenceSignals as object,
        },
      });
      return this.toEntry(entry);
    });
  }

  async cancel(userId: string): Promise<void> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException("프로필이 없습니다");
    const res = await this.prisma.matchmakingQueueEntry.updateMany({
      where: { profileId: profile.id, status: "waiting" },
      data: { status: "cancelled" },
    });
    if (res.count === 0) throw new NotFoundException("대기 중인 매칭이 없습니다");
  }

  async getStatus(userId: string): Promise<MatchmakingStatus> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) return { status: "none" };
    const entry = await this.prisma.matchmakingQueueEntry.findFirst({
      where: { profileId: profile.id },
      orderBy: { enqueuedAt: "desc" },
    });
    if (!entry) return { status: "none" };
    if (entry.status === "waiting") {
      return { status: "waiting", elapsedMs: Date.now() - new Date(entry.enqueuedAt).getTime() };
    }
    if (entry.status === "matched" && entry.matchedPartyId) {
      const party = await this.loadPublicParty(entry.matchedPartyId);
      return { status: "matched", matchedPartyId: entry.matchedPartyId, party: party ?? undefined };
    }
    return { status: "cancelled" };
  }

  async loadPublicParty(partyId: string): Promise<PublicParty | null> {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { participants: { include: { profile: true } } },
    });
    if (!party) return null;
    return {
      id: party.id,
      name: party.name,
      status: party.status,
      participants: party.participants.map((pp) => ({
        profileId: pp.profile.id,
        name: pp.profile.name,
        age: pp.profile.age,
        gender: pp.profile.gender,
        occupation: pp.profile.occupation,
        photoUrl: pp.profile.photoUrl ?? undefined,
        preferenceSummary:
          (pp.profile.preferenceSignals as { summary?: string } | null)?.summary ?? undefined,
      })),
    };
  }

  private toEntry(e: {
    id: string;
    status: string;
    enqueuedAt: Date;
    matchedPartyId: string | null;
  }): MatchmakingQueueEntry {
    return {
      id: e.id,
      status: e.status as "waiting" | "matched" | "cancelled",
      enqueuedAt: new Date(e.enqueuedAt).toISOString(),
      matchedPartyId: e.matchedPartyId,
    };
  }
}
```

- [ ] **Step 4: Write the controller** — `apps/backend/src/matchmaking/matchmaking.controller.ts`

(Match the guard/decorator imports to what `profile.controller.ts` uses.)

```ts
import { Controller, Post, Delete, Get, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/current-user.decorator";
import { MatchmakingService } from "./matchmaking.service";

@Controller("matchmaking")
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  constructor(private readonly matchmaking: MatchmakingService) {}

  @Post("queue")
  enqueue(@CurrentUser() user: JwtPayload) {
    return this.matchmaking.enqueue(user.userId);
  }

  @Delete("queue")
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@CurrentUser() user: JwtPayload) {
    return this.matchmaking.cancel(user.userId);
  }

  @Get("status")
  status(@CurrentUser() user: JwtPayload) {
    return this.matchmaking.getStatus(user.userId);
  }
}
```

> If `profile.controller.ts` imports `JwtAuthGuard`/`CurrentUser`/`JwtPayload` from different paths, use those exact paths instead — do not invent new ones.

- [ ] **Step 5: Wire the module** — `apps/backend/src/matchmaking/matchmaking.module.ts`

```ts
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MatchmakingService } from "./matchmaking.service";
import { MatchmakingController } from "./matchmaking.controller";

@Module({
  imports: [PrismaModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
```

- [ ] **Step 6: Run tests + build**

Run: `pnpm --filter @mingle/backend exec jest matchmaking.service && pnpm --filter @mingle/backend build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN`
Expected: tests PASS; build prints `CLEAN`.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/matchmaking
git commit -m "feat(backend): matchmaking queue service + REST (enqueue/cancel/status, public party projection)"
```

---

### Task 3: Backend — sweep worker, party formation, env config

**Files:**
- Create: `apps/backend/src/matchmaking/matchmaking.config.ts`
- Create: `apps/backend/src/matchmaking/matchmaking.sweep.ts`
- Create: `apps/backend/src/matchmaking/matchmaking.sweep.spec.ts`
- Modify: `apps/backend/src/matchmaking/matchmaking.module.ts` (provide the sweep + config)
- Modify: root `.env.example` (append matchmaking vars)

**Interfaces:**
- Consumes: `PrismaService`; `ConfigService` (`@nestjs/config`); `preferenceScore` from `@mingle/shared`; `PreferenceSignals` from `@mingle/shared`.
- Produces: `MatchmakingConfig` (`{ min, max, sweepMs, maxWaitMs, baseThreshold }`); `MatchmakingSweepService` with `runSweep(now: Date): Promise<{ formed: number; cancelled: number }>` and `formParty(group, now)`. Lifecycle `onModuleInit` starts a `setInterval`; `onModuleDestroy` clears it.

- [ ] **Step 1: Write the config** — `apps/backend/src/matchmaking/matchmaking.config.ts`

```ts
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface MatchmakingConfig {
  min: number;
  max: number;
  sweepMs: number;
  maxWaitMs: number;
  baseThreshold: number;
}

function intOr(raw: string | undefined, def: number, { min = 1 } = {}): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : def;
}
function floatOr(raw: string | undefined, def: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

@Injectable()
export class MatchmakingConfigProvider {
  readonly value: MatchmakingConfig;
  constructor(config: ConfigService) {
    const min = intOr(config.get("MIN_PARTY_SIZE"), 4);
    const maxRaw = intOr(config.get("MAX_PARTY_SIZE"), 8);
    this.value = {
      min,
      max: Math.max(min, maxRaw),
      sweepMs: intOr(config.get("MATCH_SWEEP_MS"), 2500, { min: 250 }),
      maxWaitMs: intOr(config.get("MATCH_MAX_WAIT_MS"), 120000, { min: 1000 }),
      baseThreshold: floatOr(config.get("MATCH_BASE_THRESHOLD"), 0.5),
    };
  }
}
```

- [ ] **Step 2: Write the failing test** — `apps/backend/src/matchmaking/matchmaking.sweep.spec.ts`

```ts
import { MatchmakingSweepService } from "./matchmaking.sweep";
import type { MatchmakingConfig } from "./matchmaking.config";

const cfg: MatchmakingConfig = { min: 4, max: 8, sweepMs: 2500, maxWaitMs: 120000, baseThreshold: 0.5 };
const sig = (v: string) => ({ vibe: v, drinking: "light", pace: "slow", activity: [], tags: [], summary: "s" });

function entry(id: string, vibe: string, ageSec: number, now: Date) {
  return { id, profileId: "prof-" + id, status: "waiting", matchedPartyId: null,
    preferenceSnapshot: sig(vibe), enqueuedAt: new Date(now.getTime() - ageSec * 1000) };
}

function makePrisma(waiting: any[]) {
  const claimed = new Set<string>();
  return {
    _party: null as any,
    matchmakingQueueEntry: {
      findMany: jest.fn().mockResolvedValue(waiting),
      updateMany: jest.fn(async ({ where }: any) => {
        // status-guarded: only claims entries not already claimed
        if (where.id && where.status === "waiting") {
          if (claimed.has(where.id)) return { count: 0 };
          claimed.add(where.id);
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
    party: { create: jest.fn(async ({ data }: any) => ({ id: "party-1", ...data })) },
    partyParticipant: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn(async (fn: any) => fn(prismaTx)),
  } as any;
}
let prismaTx: any;

describe("MatchmakingSweepService.runSweep", () => {
  it("forms one party when >= min compatible entries are waiting", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const waiting = ["a", "b", "c", "d"].map((id) => entry(id, "calm", 1, now));
    const prisma = makePrisma(waiting);
    prismaTx = prisma; // same guarded updateMany + create used inside the tx
    const svc = new MatchmakingSweepService(prisma, { value: cfg } as any);
    const res = await svc.runSweep(now);
    expect(res.formed).toBe(1);
    expect(prisma.party.create).toHaveBeenCalledTimes(1);
    expect(prisma.partyParticipant.createMany).toHaveBeenCalledTimes(1);
  });

  it("does not form a party below min", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const prisma = makePrisma(["a", "b", "c"].map((id) => entry(id, "calm", 1, now)));
    prismaTx = prisma;
    const svc = new MatchmakingSweepService(prisma, { value: cfg } as any);
    const res = await svc.runSweep(now);
    expect(res.formed).toBe(0);
  });

  it("cancels entries older than maxWaitMs", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const prisma = makePrisma([entry("old", "calm", 200, now)]); // 200s > 120s
    prismaTx = prisma;
    const svc = new MatchmakingSweepService(prisma, { value: cfg } as any);
    const res = await svc.runSweep(now);
    expect(res.cancelled).toBe(1);
    expect(prisma.matchmakingQueueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "cancelled" } }),
    );
  });

  it("relaxing threshold lets dissimilar users match only after waiting", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    // 4 users, all different vibes → score between any pair is low; fresh → no match
    const fresh = ["a", "b", "c", "d"].map((id, i) => entry(id, ["calm","energetic","balanced","calm"][i], 1, now));
    const p1 = makePrisma(fresh); prismaTx = p1;
    expect((await new MatchmakingSweepService(p1, { value: cfg } as any).runSweep(now)).formed).toBe(0);
    // same users but each waited ~119s → threshold ~0 → they match
    const aged = ["a", "b", "c", "d"].map((id, i) => entry(id, ["calm","energetic","balanced","calm"][i], 119, now));
    const p2 = makePrisma(aged); prismaTx = p2;
    expect((await new MatchmakingSweepService(p2, { value: cfg } as any).runSweep(now)).formed).toBe(1);
  });

  it("dedupes multiple waiting entries from the same profile", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const dup = [entry("a", "calm", 1, now), { ...entry("a2", "calm", 1, now), profileId: "prof-a" }];
    const rest = ["b", "c", "d"].map((id) => entry(id, "calm", 1, now));
    const prisma = makePrisma([...dup, ...rest]);
    prismaTx = prisma;
    const svc = new MatchmakingSweepService(prisma, { value: cfg } as any);
    await svc.runSweep(now);
    // only 4 distinct profiles → party of exactly 4; the duplicate profile appears once
    const createArg = prisma.partyParticipant.createMany.mock.calls[0][0].data;
    const profileIds = createArg.map((d: any) => d.profileId);
    expect(new Set(profileIds).size).toBe(profileIds.length);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @mingle/backend exec jest matchmaking.sweep`
Expected: FAIL (cannot find `./matchmaking.sweep`).

- [ ] **Step 4: Write the sweep service** — `apps/backend/src/matchmaking/matchmaking.sweep.ts`

```ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MatchmakingConfigProvider } from "./matchmaking.config";
import { preferenceScore } from "@mingle/shared";
import type { PreferenceSignals } from "@mingle/shared";

type Entry = {
  id: string;
  profileId: string;
  status: string;
  matchedPartyId: string | null;
  preferenceSnapshot: unknown;
  enqueuedAt: Date;
};

@Injectable()
export class MatchmakingSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MatchmakingSweepService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configProvider: MatchmakingConfigProvider,
  ) {}

  private get cfg() {
    return this.configProvider.value;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, this.cfg.sweepMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runSweep(new Date());
    } catch (e) {
      this.log.warn(`sweep failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async runSweep(now: Date): Promise<{ formed: number; cancelled: number }> {
    const waiting = (await this.prisma.matchmakingQueueEntry.findMany({
      where: { status: "waiting" },
      orderBy: { enqueuedAt: "asc" },
    })) as unknown as Entry[];

    // dedupe: one entry per profile (oldest, since ordered asc)
    const seen = new Set<string>();
    const deduped: Entry[] = [];
    for (const e of waiting) {
      if (!seen.has(e.profileId)) {
        seen.add(e.profileId);
        deduped.push(e);
      }
    }

    // timeout pass
    let cancelled = 0;
    const active: Entry[] = [];
    for (const e of deduped) {
      if (now.getTime() - new Date(e.enqueuedAt).getTime() > this.cfg.maxWaitMs) {
        const r = await this.prisma.matchmakingQueueEntry.updateMany({
          where: { id: e.id, status: "waiting" },
          data: { status: "cancelled" },
        });
        if (r.count) cancelled++;
      } else {
        active.push(e);
      }
    }

    // formation pass
    let formed = 0;
    const pool = [...active];
    while (pool.length >= this.cfg.min) {
      const anchor = pool.shift()!;
      const anchorElapsed = now.getTime() - new Date(anchor.enqueuedAt).getTime();
      const threshold = this.cfg.baseThreshold * Math.max(0, 1 - anchorElapsed / this.cfg.maxWaitMs);
      const anchorSig = anchor.preferenceSnapshot as PreferenceSignals;

      const ranked = pool
        .map((e) => ({ e, s: preferenceScore(anchorSig, e.preferenceSnapshot as PreferenceSignals) }))
        .filter((x) => x.s >= threshold)
        .sort((a, b) => b.s - a.s)
        .slice(0, this.cfg.max - 1);

      if (1 + ranked.length >= this.cfg.min) {
        const group = [anchor, ...ranked.map((x) => x.e)];
        const ok = await this.formParty(group, now);
        if (ok) {
          formed++;
          const ids = new Set(ranked.map((x) => x.e.id));
          for (let i = pool.length - 1; i >= 0; i--) if (ids.has(pool[i].id)) pool.splice(i, 1);
        }
      }
      // if not formed, the anchor is simply dropped from this tick (stays waiting in DB)
    }

    return { formed, cancelled };
  }

  async formParty(group: Entry[], now: Date): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const e of group) {
          const r = await tx.matchmakingQueueEntry.updateMany({
            where: { id: e.id, status: "waiting" },
            data: { status: "matched" },
          });
          if (r.count === 0) throw new Error("entry already claimed");
        }
        const party = await tx.party.create({
          data: {
            name: `파티 ${now.getTime().toString(36).slice(-5)}`,
            status: "active",
            startedAt: now,
            maxParticipants: this.cfg.max,
          },
        });
        await tx.partyParticipant.createMany({
          data: group.map((e) => ({ partyId: party.id, profileId: e.profileId })),
        });
        await tx.matchmakingQueueEntry.updateMany({
          where: { id: { in: group.map((e) => e.id) } },
          data: { matchedPartyId: party.id },
        });
      });
      return true;
    } catch (e) {
      this.log.warn(`formParty rolled back: ${(e as Error).message}`);
      return false;
    }
  }
}
```

- [ ] **Step 5: Register the sweep + config in the module** — `apps/backend/src/matchmaking/matchmaking.module.ts`

```ts
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MatchmakingService } from "./matchmaking.service";
import { MatchmakingController } from "./matchmaking.controller";
import { MatchmakingSweepService } from "./matchmaking.sweep";
import { MatchmakingConfigProvider } from "./matchmaking.config";

@Module({
  imports: [PrismaModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService, MatchmakingSweepService, MatchmakingConfigProvider],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
```

> `ConfigService` must be resolvable here. If `ConfigModule` is global in `app.module.ts` (it is — Phase 2 injects `ConfigService` in `AiModule`), no extra import is needed. If a build/boot error says `ConfigService` can't be resolved, add `ConfigModule` to this module's `imports`.

- [ ] **Step 6: Append env vars** — root `.env.example` (after the LLM block)

```
# Matchmaking queue (Phase 3)
MIN_PARTY_SIZE=4
MAX_PARTY_SIZE=8
MATCH_SWEEP_MS=2500
MATCH_MAX_WAIT_MS=120000
MATCH_BASE_THRESHOLD=0.5
```

- [ ] **Step 7: Run tests + build + boot**

Run:
```
pnpm --filter @mingle/backend exec jest matchmaking && \
pnpm --filter @mingle/backend build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN
```
Then boot to confirm the interval starts and DI resolves:
```
docker compose up -d && node -e "require('child_process').execSync('node dist/main.js',{cwd:'apps/backend',timeout:8000,stdio:'inherit'})" 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -iE "MatchmakingModule|successfully started|error" | head
```
Expected: jest PASS; build `CLEAN`; boot shows `MatchmakingModule dependencies initialized` + `Nest application successfully started`. Kill the process afterward (`pkill -f "node dist/main.js"`).

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/matchmaking .env.example
git commit -m "feat(backend): matchmaking sweep worker + party formation (relaxing threshold, status-guarded claims, env config)"
```

---

### Task 4: `@mingle/client-core` — matchmaking API

**Files:**
- Create: `packages/client-core/src/api/matchmaking.ts`
- Create: `packages/client-core/src/__tests__/matchmaking-api.test.ts`
- Modify: `packages/client-core/src/index.ts` (barrel exports)

**Interfaces:**
- Consumes: `apiFetch` from `./client.js`; shared types `MatchmakingQueueEntry`, `MatchmakingStatus`.
- Produces: `enqueueMatchmaking()`, `cancelMatchmaking()`, `getMatchmakingStatus()`.

> `@mingle/client-core` uses **Vitest**. Follow the existing `src/__tests__/profiles-api.test.ts` for the exact fetch-mock + client-config + token-accessor setup. Use `vi`, not `jest`.

- [ ] **Step 1: Write the failing test** — `packages/client-core/src/__tests__/matchmaking-api.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { enqueueMatchmaking, cancelMatchmaking, getMatchmakingStatus } from "../api/matchmaking.js";
// Mirror the imports profiles-api.test.ts uses to configure the client base URL + token accessor.
import { configureClient } from "../client.js"; // <-- use whatever profiles-api.test.ts imports

const okJson = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

describe("matchmaking api", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // configure base URL + token accessor exactly as profiles-api.test.ts does
  });
  afterEach(() => vi.unstubAllGlobals());

  it("enqueue POSTs /matchmaking/queue", async () => {
    fetchMock.mockReturnValue(okJson({ id: "e1", status: "waiting", enqueuedAt: "t" }));
    const res = await enqueueMatchmaking();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/matchmaking/queue");
    expect(opts.method).toBe("POST");
    expect(res.status).toBe("waiting");
  });

  it("cancel DELETEs /matchmaking/queue", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(undefined) } as Response));
    await cancelMatchmaking();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/matchmaking/queue");
    expect(opts.method).toBe("DELETE");
  });

  it("getStatus GETs /matchmaking/status", async () => {
    fetchMock.mockReturnValue(okJson({ status: "waiting", elapsedMs: 1200 }));
    const res = await getMatchmakingStatus();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/matchmaking/status");
    expect(res.status).toBe("waiting");
  });
});
```

> Adjust the client-config/token-accessor lines to match `profiles-api.test.ts` verbatim before running.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/client-core exec vitest run src/__tests__/matchmaking-api.test.ts`
Expected: FAIL (cannot resolve `../api/matchmaking.js`).

- [ ] **Step 3: Write the API** — `packages/client-core/src/api/matchmaking.ts`

```ts
import type { MatchmakingQueueEntry, MatchmakingStatus } from "@mingle/shared";
import { apiFetch } from "./client.js";

export function enqueueMatchmaking(): Promise<MatchmakingQueueEntry> {
  return apiFetch<MatchmakingQueueEntry>("/matchmaking/queue", { method: "POST" });
}

export function cancelMatchmaking(): Promise<void> {
  return apiFetch<void>("/matchmaking/queue", { method: "DELETE" });
}

export function getMatchmakingStatus(): Promise<MatchmakingStatus> {
  return apiFetch<MatchmakingStatus>("/matchmaking/status");
}
```

- [ ] **Step 4: Add barrel exports** — append to `packages/client-core/src/index.ts`

```ts
export { enqueueMatchmaking, cancelMatchmaking, getMatchmakingStatus } from "./api/matchmaking.js";
```

- [ ] **Step 5: Run tests + build**

Run: `pnpm --filter @mingle/client-core test && pnpm --filter @mingle/client-core build`
Expected: all tests PASS (existing + 3 new); build clean.

- [ ] **Step 6: Commit**

```bash
git add packages/client-core/src/api/matchmaking.ts packages/client-core/src/__tests__/matchmaking-api.test.ts packages/client-core/src/index.ts
git commit -m "feat(client-core): matchmaking API (enqueue/cancel/status)"
```

---

### Task 5: Mobile — matching UX (start / waiting / matched-placeholder)

**Files:**
- Create: `apps/mobile/app/(app)/matching.tsx` (waiting screen)
- Create: `apps/mobile/app/(app)/party/[id].tsx` (party placeholder)
- Modify: `apps/mobile/app/(app)/home.tsx` (add "매칭 시작")

**Interfaces:**
- Consumes: `enqueueMatchmaking`, `cancelMatchmaking`, `getMatchmakingStatus` + `MatchmakingStatus` from `@mingle/client-core`; `router`/`useLocalSearchParams` from `expo-router`; `ApiError` from `@mingle/client-core`.
- Produces: three routes; `home` links to `/(app)/matching`.

> Follow `apps/mobile/app/onboarding.tsx` for the busy/error + `ApiError` handling and `StyleSheet` conventions. Poll with an `alive` guard + `setTimeout` loop (not `setInterval`) so an in-flight request never overlaps and unmount cancels cleanly.

- [ ] **Step 1: Add the "매칭 시작" action to home** — `apps/mobile/app/(app)/home.tsx`

Add near the existing content (keep the notice banner + existing UI):
```tsx
import { router } from "expo-router";
// ...inside the component's JSX, add a button:
<Button title="매칭 시작" onPress={() => router.push("/(app)/matching")} />
```
(If `home.tsx` doesn't import `Button`, add it to the `react-native` import.)

- [ ] **Step 2: Write the waiting screen** — `apps/mobile/app/(app)/matching.tsx`

```tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, Button, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import {
  enqueueMatchmaking,
  cancelMatchmaking,
  getMatchmakingStatus,
  ApiError,
} from "@mingle/client-core";

const POLL_MS = 2500;

export default function Matching() {
  const [phase, setPhase] = useState<"joining" | "waiting" | "failed" | "error">("joining");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const s = await getMatchmakingStatus();
        if (!alive.current) return;
        if (s.status === "matched" && s.matchedPartyId) {
          router.replace(`/(app)/party/${s.matchedPartyId}`);
          return;
        }
        if (s.status === "cancelled" || s.status === "none") {
          setPhase("failed");
          return;
        }
        setPhase("waiting");
        setElapsed(s.elapsedMs ?? 0);
        timer = setTimeout(poll, POLL_MS);
      } catch (e) {
        if (!alive.current) return;
        setError(e instanceof ApiError ? e.message : "매칭 상태를 불러오지 못했습니다.");
        setPhase("error");
      }
    }

    (async () => {
      try {
        await enqueueMatchmaking();
        if (!alive.current) return;
        setPhase("waiting");
        poll();
      } catch (e) {
        if (!alive.current) return;
        setError(e instanceof ApiError ? e.message : "매칭을 시작하지 못했습니다.");
        setPhase("error");
      }
    })();

    return () => {
      alive.current = false;
      clearTimeout(timer);
    };
  }, []);

  async function onCancel() {
    alive.current = false;
    try {
      await cancelMatchmaking();
    } catch {
      // ignore — leaving the screen is the intent
    }
    router.replace("/(app)/home");
  }

  if (phase === "failed") {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>지금은 매칭이 어려워요. 잠시 후 다시 시도해 주세요.</Text>
        <Button title="다시 시도" onPress={() => router.replace("/(app)/matching")} />
        <Button title="홈으로" onPress={() => router.replace("/(app)/home")} />
      </View>
    );
  }
  if (phase === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Button title="홈으로" onPress={() => router.replace("/(app)/home")} />
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" />
      <Text style={styles.msg}>매칭 중...</Text>
      <Text style={styles.sub}>{Math.floor(elapsed / 1000)}초 경과</Text>
      <Button title="취소" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 24 },
  msg: { fontSize: 16, color: "#333" },
  sub: { fontSize: 13, color: "#888" },
  error: { color: "red", textAlign: "center" },
});
```

- [ ] **Step 3: Write the party placeholder** — `apps/mobile/app/(app)/party/[id].tsx`

```tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Button, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getMatchmakingStatus, ApiError } from "@mingle/client-core";
import type { PublicParty } from "@mingle/shared";

export default function PartyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [party, setParty] = useState<PublicParty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    getMatchmakingStatus()
      .then((s) => {
        if (!alive.current) return;
        if (s.party && s.party.id === id) setParty(s.party);
        else setError("파티 정보를 찾을 수 없습니다.");
      })
      .catch((e) => {
        if (alive.current) setError(e instanceof ApiError ? e.message : "불러오기 실패");
      });
    return () => {
      alive.current = false;
    };
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Button title="홈으로" onPress={() => router.replace("/(app)/home")} />
      </View>
    );
  }
  if (!party) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{party.name}</Text>
      <Text style={styles.sub}>곧 파티가 시작됩니다 · {party.participants.length}명</Text>
      {party.participants.map((p) => (
        <View key={p.profileId} style={styles.card}>
          <Text style={styles.name}>{p.name} · {p.age}</Text>
          <Text style={styles.meta}>{p.occupation}</Text>
          {p.preferenceSummary ? <Text style={styles.summary}>{p.preferenceSummary}</Text> : null}
        </View>
      ))}
      <Button title="홈으로" onPress={() => router.replace("/(app)/home")} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 24 },
  container: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "600" },
  sub: { fontSize: 13, color: "#888", marginBottom: 8 },
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 12, gap: 4 },
  name: { fontSize: 16, fontWeight: "500" },
  meta: { fontSize: 13, color: "#555" },
  summary: { fontSize: 13, color: "#777" },
  error: { color: "red", textAlign: "center" },
});
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN`
Expected: `CLEAN`. (Expo regenerates `.expo/types/router.d.ts` on next dev start; if `tsc` complains about the new `/(app)/matching` or `/(app)/party/[id]` routes, run `pnpm --filter @mingle/mobile exec expo customize tsconfig.json` is NOT needed — instead start `expo` once, or add the routes to the generated types; the routes are valid Expo Router file routes.)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app
git commit -m "feat(mobile): matchmaking UX — start, waiting (poll+cancel), party placeholder"
```

---

## Self-Review

**1. Spec coverage:**
- §3 no-migration / reuse models → Tasks 2–3 use existing models, no `migrate`. ✓
- §4 `preferenceScore` in shared → Task 1. ✓
- §5.1 API (enqueue 404/400/idempotent, cancel 404, status) → Task 2. ✓
- §5.2 public projection (no riskScore / raw signals, only summary) → Task 2 `loadPublicParty` + test. ✓
- §5.3 sweep (timeout, relaxing threshold, anchor grouping) → Task 3. ✓
- §7 concurrency (status-guarded claims, $transaction, profileId dedupe) → Task 3 `formParty` + dedupe + test. ✓
- §8 env config + validation → Task 3 `MatchmakingConfigProvider`. ✓
- §6 mobile (start/waiting/cancel/matched-placeholder, polling) → Task 5. ✓
- §9 client-core API → Task 4. ✓
- Green gate (all packages) → run at the end of each task; final review verifies whole-branch.

**2. Placeholder scan:** No TBD/TODO. Every code step is complete. The two spots that say "match what `profiles-api.test.ts` / `profile.controller.ts` uses" are explicit instructions to copy verbatim existing, discoverable patterns (client config + guard imports), not vague placeholders.

**3. Type consistency:** `preferenceScore(a,b,weights?)` (Task 1) used in Task 3. `MatchmakingQueueEntry`/`MatchmakingStatus`/`PublicParty` (Task 1) used in Tasks 2/4/5. `MatchmakingConfig` (`{min,max,sweepMs,maxWaitMs,baseThreshold}`) defined + consumed in Task 3. Endpoints `POST/DELETE /matchmaking/queue`, `GET /matchmaking/status` consistent across Tasks 2/4/5. `runSweep(now)`/`formParty(group, now)` consistent in Task 3.

**Deferred (not in scope, documented in the spec):** realtime Socket.IO push, Redis distributed sweep lock (multi-instance), gender/age balance weighting, the actual 2D party experience. `estimatedWaitMs` is a reserved optional field — v1 returns only `elapsedMs`.
