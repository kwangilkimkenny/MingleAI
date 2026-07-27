# Phase 1 — Data Model v2 + Backend Domain Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v1 AI-agent data model with the v2 real-user domain (matchmaking/party/proposal/match/messenger/block), via a clean-reset Prisma migration plus the backend code changes to compile and boot against it.

**Architecture:** Five ordered tasks. Task 1 deletes obsolete code while the old schema still stands (stays green). Task 2 flips `@mingle/shared` to v2 types (builds standalone). Task 3 flips the Prisma schema and clean-resets the migration (validated by `prisma`; backend build is intentionally red for this one task). Task 4 migrates every surviving backend module to the v2 client → full backend green. Task 5 adds the new empty domain skeletons and wires them → green. Business logic for the new domains is out of scope (later phases).

**Tech Stack:** NestJS 10, Prisma 6 + PostgreSQL, pnpm workspaces, Jest. Spec of record: `docs/superpowers/specs/2026-06-29-phase1-data-model-v2-design.md` (its §3 is the authoritative v2 schema).

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-06-29-phase1-data-model-v2-design.md`. Where this plan says "the v2 schema", it means **exactly** the Prisma models in that spec's §3 — copy them verbatim.
- Migration strategy: **clean reset** — delete `apps/backend/prisma/migrations/*` and create a single `v2_baseline`. No data preservation (pre-product, no real users).
- Scope: **data layer + cleanup only**. New domains (matchmaking, proposal, match, messenger) are **empty skeletons** — no business logic, no routes beyond what compiles. `Block` lives in the existing `safety` module (no separate module).
- Green targets for this plan: `@mingle/backend`, `@mingle/shared`. Do **NOT** touch or chase `apps/web` (it may break against the new API/types — handled later) or `@mingle/mingles-mcp` (pre-existing broken).
- Do NOT touch `apps/mobile` / `@mingle/client-core` (must stay green).
- Env quirks: use `pnpm install --ignore-scripts` (plain install fails on better-sqlite3 native build). Prisma migrate/generate needs a running Postgres → `docker compose up -d` first. The dev DB will be dropped by the clean reset.
- Removed v1 concepts (must not survive anywhere in backend/shared): AI agent conversation/simulation, `Report` (AI match report), `PartyReservation`, round-based parties, `agentPersona`/`communicationStyle`/`values`/`preferences` profile fields.

## File Structure

```
apps/backend/
├── prisma/
│   ├── schema.prisma                 # REPLACE with v2 (spec §3)
│   └── migrations/                    # CLEAN RESET → single v2_baseline
├── src/
│   ├── report/                        # DELETE (whole dir)
│   ├── reservation/                   # DELETE (whole dir)
│   ├── party/
│   │   ├── party.gateway.ts           # DELETE
│   │   ├── party.service.ts           # GUT to skeleton (read-only)
│   │   ├── party.controller.ts        # read routes only
│   │   ├── party.service.spec.ts      # DELETE/replace
│   │   └── dto/                        # drop AI/round DTO fields
│   ├── profile/                       # simplify DTOs/service to v2
│   ├── date-plan/                     # re-link to matchId
│   ├── admin/                         # drop report mgmt
│   ├── dashboard/                     # drop reservation/report queries
│   ├── safety/                        # + Block create/list
│   ├── common/dto/                    # DELETE communication-style/user-preferences/user-values
│   ├── matchmaking/                   # NEW skeleton (module+service)
│   ├── proposal/                      # NEW skeleton
│   ├── match/                         # NEW skeleton
│   ├── messenger/                     # NEW skeleton
│   └── app.module.ts                  # remove report/reservation, add 4 skeletons
packages/shared/src/                   # REPLACE v1 types with v2
```

---

## Task 1: Remove obsolete backend code (on the old schema)

Deletes v1 AI/report/reservation code and all references, while `schema.prisma` is unchanged so everything still compiles. Ends green.

**Files:**
- Delete: `apps/backend/src/report/` (entire dir), `apps/backend/src/reservation/` (entire dir), `apps/backend/src/party/party.gateway.ts`, `apps/backend/src/party/party.service.spec.ts`
- Delete: `apps/backend/src/common/dto/communication-style.dto.ts`, `apps/backend/src/common/dto/user-preferences.dto.ts`, `apps/backend/src/common/dto/user-values.dto.ts`
- Modify: `apps/backend/src/app.module.ts`, `apps/backend/src/common/dto/index.ts`, `apps/backend/src/party/party.module.ts`, `apps/backend/src/party/party.service.ts` (remove AI/simulation methods + gateway provider), and any `admin`/`dashboard` references to report/reservation services.

**Interfaces:**
- Consumes: nothing.
- Produces: a backend with no `report`/`reservation` modules, no party gateway, no AI-conversation code. `Report`/`PartyReservation` Prisma models still exist (removed in Task 3) but are now unreferenced by code.

- [ ] **Step 1: Inventory references before deleting**

Run:
```bash
cd /Users/namuneulbo/Desktop/mingles/.claude/worktrees/mobile-pivot-plan
grep -rln --include=*.ts -e "ReportModule\|ReportService\|report\.service\|ReservationModule\|ReservationService\|party\.gateway\|PartyGateway\|CommunicationStyleDto\|UserPreferencesDto\|UserValuesDto" apps/backend/src
```
Expected: a list including `app.module.ts`, `report/*`, `reservation/*`, `party/*`, possibly `admin/*`, `dashboard/*`, `common/dto/index.ts`. Note every file — each must end up with zero references to the deleted symbols.

- [ ] **Step 2: Delete the obsolete dirs/files**

```bash
git rm -r apps/backend/src/report apps/backend/src/reservation
git rm apps/backend/src/party/party.gateway.ts apps/backend/src/party/party.service.spec.ts
git rm apps/backend/src/common/dto/communication-style.dto.ts apps/backend/src/common/dto/user-preferences.dto.ts apps/backend/src/common/dto/user-values.dto.ts
```

- [ ] **Step 3: Strip references from importers**

Edit each file from Step 1's list:
- `apps/backend/src/app.module.ts`: remove `ReportModule` and `ReservationModule` from imports array and their `import` lines.
- `apps/backend/src/party/party.module.ts`: remove the gateway from `providers`/imports.
- `apps/backend/src/party/party.service.ts`: remove any method that runs AI simulation / references the gateway (e.g. `runParty`, conversation generation). Keep only data access methods that compile against the **current** schema (create/find). Do not add new behavior here.
- `apps/backend/src/common/dto/index.ts`: remove the three deleted DTO re-exports.
- `apps/backend/src/admin/*` and `apps/backend/src/dashboard/*`: remove any import/use of `ReportService`/`ReservationService` and the report/reservation code paths (drop those admin actions / dashboard stats).

After editing, re-run the Step 1 grep — expected: **no matches**.

- [ ] **Step 4: Verify build + tests green (old schema)**

Run:
```bash
docker compose up -d
pnpm install --ignore-scripts
pnpm --filter @mingle/backend exec prisma generate
pnpm --filter @mingle/backend build
pnpm --filter @mingle/backend test
```
Expected: `nest build` succeeds; Jest passes (the removed `party.service.spec.ts` is gone; remaining specs pass). If a remaining spec references deleted code, update it to drop those assertions (do not test removed behavior).
If `docker compose`/Postgres is unavailable in this environment, report BLOCKED — the migration tasks need it too.

- [ ] **Step 5: Commit**

```bash
git add -A apps/backend
git commit -m "refactor(backend): remove v1 AI/report/reservation code (pre-schema cleanup)"
```

---

## Task 2: `@mingle/shared` → v2 types

Flip the shared type package to v2. It has no backend dependency, so it builds standalone and gives a clean gate. (Backend still imports old shared names and would not build — but we don't build backend in this task.)

**Files:**
- Modify: `packages/shared/src/index.ts` and the files under `packages/shared/src/types/` (replace v1 type modules with v2).

**Interfaces:**
- Consumes: nothing.
- Produces (exported types, names used by Task 4):
  - `Profile` — `{ id; userId; name; age:number; gender:string; occupation:string; partyPreferenceText:string; preferenceSignals?: unknown; photoUrl?:string; interests?: unknown; bio?:string; location?:string; riskScore:number; status:string; createdAt; updatedAt }`
  - `PartyStatus = "matching" | "active" | "ended"`; `Party` with that status + `maxParticipants`, `startedAt?`, `endedAt?`
  - `MatchmakingQueueStatus = "waiting" | "matched" | "cancelled"`; `MatchmakingQueueEntry`
  - `ProposalStatus = "pending" | "accepted" | "declined"`; `Proposal`
  - `Match`, `DirectMessageRoom`, `DirectMessage`, `Block`, `PartyMessage`, `GameSession`
  - `DatePlan` with `matchId` (no `profileId1/2`)
  - Removed: all `Report*`, `ConversationTone`/`CommunicationStyle`/`UserValues`/`UserPreferences`, party rounds/results, party-sim types.

- [ ] **Step 1: Inventory current shared exports**

```bash
cd /Users/namuneulbo/Desktop/mingles/.claude/worktrees/mobile-pivot-plan
sed -n '1,200p' packages/shared/src/index.ts
ls packages/shared/src/types
```
Expected: see the v1 export list (profile/party/report/safety/...) and the `types/*.ts` files. These define what to replace.

- [ ] **Step 2: Replace the type modules with v2**

Rewrite `packages/shared/src/types/profile.ts` (or equivalent) to the v2 `Profile` shape above; rewrite `party.ts` to the v2 `Party`/`PartyStatus`; delete `report.ts` (and its re-export); add new modules (e.g. `matching.ts`, `social.ts`, `messaging.ts`) for `MatchmakingQueueEntry`, `Proposal`, `Match`, `Block`, `DirectMessage`, `DirectMessageRoom`, `PartyMessage`, `GameSession`, and update `DatePlan` to use `matchId`. Keep the file-per-domain layout already used. Example for the new `Proposal` type:

```ts
// packages/shared/src/types/social.ts
export type ProposalStatus = "pending" | "accepted" | "declined";

export interface Proposal {
  id: string;
  partyId: string;
  fromProfileId: string;
  toProfileId: string;
  status: ProposalStatus;
  createdAt: string;
  respondedAt?: string;
}

export interface Match {
  id: string;
  partyId?: string;
  proposalId?: string;
  profileId1: string;
  profileId2: string;
  createdAt: string;
}

export interface Block {
  id: string;
  blockerProfileId: string;
  blockedProfileId: string;
  createdAt: string;
}
```

- [ ] **Step 3: Update the barrel `packages/shared/src/index.ts`**

Replace the v1 `export type { ... }` blocks with the v2 ones (export every new type; remove all `Report*` and removed-profile/party type exports). Use the existing `./types/<file>.js` extension convention.

- [ ] **Step 4: Verify shared builds clean**

```bash
pnpm --filter @mingle/shared build
```
Expected: `tsc` succeeds, `dist/index.d.ts` regenerates, no references to deleted types.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): replace v1 types with v2 domain types"
```

---

## Task 3: Prisma v2 schema + clean-reset migration

Flip the schema to v2 and rebuild the migration history as a single baseline. Validated by Prisma. **The backend build is intentionally red after this task** (its services still reference old fields/models) — restored in Task 4. Do not attempt to fix backend code here.

**Files:**
- Modify: `apps/backend/prisma/schema.prisma` (replace models with spec §3)
- Delete/recreate: `apps/backend/prisma/migrations/*`

**Interfaces:**
- Consumes: nothing.
- Produces: a generated Prisma client with the v2 models (`Profile` simplified; `Party` matching/active/ended; `MatchmakingQueueEntry`, `PartyMessage`, `GameSession`, `Proposal`, `Match`, `DirectMessageRoom`, `DirectMessage`, `Block`; `DatePlan.matchId`; no `Report`/`PartyReservation`). Exact field/model names per spec §3 — Task 4 depends on them.

- [ ] **Step 1: Replace `schema.prisma` with the v2 schema**

Open `docs/superpowers/specs/2026-06-29-phase1-data-model-v2-design.md` §3 and set `apps/backend/prisma/schema.prisma` to contain **exactly** those models (keep the existing `generator client` and `datasource db` blocks at the top unchanged). Ensure: `Report` and `PartyReservation` models are absent; `Profile` has `partyPreferenceText`/`preferenceSignals`/`photoUrl`/`interests` and no `agentPersona`/`communicationStyle`/`values`/`preferences`; `Party` has `status`/`startedAt`/`endedAt`/`maxParticipants` and none of the round/scheduledAt/results fields; `DatePlan` uses `matchId`; the new models exist with the relations and `@@unique`/`@@index` as written in the spec.

- [ ] **Step 2: Validate the schema**

```bash
cd /Users/namuneulbo/Desktop/mingles/.claude/worktrees/mobile-pivot-plan
pnpm --filter @mingle/backend exec prisma validate
pnpm --filter @mingle/backend exec prisma format
```
Expected: "The schema at ... is valid 🚀". If validation fails (e.g. a missing back-relation), fix the schema to match the spec's relation pairs, then re-run.

- [ ] **Step 3: Clean-reset the migration history**

```bash
docker compose up -d
rm -rf apps/backend/prisma/migrations
pnpm --filter @mingle/backend exec prisma migrate dev --name v2_baseline
```
Expected: Prisma drops/recreates the dev DB, creates `prisma/migrations/<timestamp>_v2_baseline/migration.sql`, and reports the migration applied. (Answer "yes" to the data-loss prompt if shown; this is the intended clean reset. If the command is non-interactive in this env and stalls, run `prisma migrate reset --force` first, then `migrate dev --name v2_baseline`.)

- [ ] **Step 4: Generate the client and confirm the new models exist**

```bash
pnpm --filter @mingle/backend exec prisma generate
grep -l "matchmaking_queue_entries\|proposals\|direct_message_rooms\|blocks" apps/backend/prisma/migrations/*/migration.sql
```
Expected: `prisma generate` succeeds; the grep finds the baseline `migration.sql` (confirms the new tables are in the migration). The backend TypeScript build will NOT pass yet — that is expected and handled in Task 4.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma
git commit -m "feat(backend): v2 Prisma schema + clean-reset v2_baseline migration"
```

---

## Task 4: Migrate surviving backend modules to v2 → full backend green

Update every remaining backend module to compile and behave against the v2 client. After this task the whole backend builds, boots, and tests pass. The new domain skeletons are NOT added here (Task 5) — and since they're additive, the backend is fully green without them.

**Files:**
- Modify: `apps/backend/src/profile/` (dto/service/controller), `apps/backend/src/party/` (service→read-only skeleton, controller read routes, dto), `apps/backend/src/date-plan/` (matchId), `apps/backend/src/admin/`, `apps/backend/src/dashboard/`, `apps/backend/src/safety/` (+Block), plus any other file the build flags.
- Test: `apps/backend/src/profile/profile.service.spec.ts` (add/keep), `apps/backend/src/safety/safety.service.spec.ts` (Block).

**Interfaces:**
- Consumes: v2 Prisma client (Task 3), v2 `@mingle/shared` types (Task 2).
- Produces: a compiling, booting backend whose surviving controllers serve v2-shaped data. `SafetyService` gains `createBlock(blockerProfileId, blockedProfileId)` and `listBlocks(profileId)`.

- [ ] **Step 1: Enumerate the compile errors to fix**

```bash
cd /Users/namuneulbo/Desktop/mingles/.claude/worktrees/mobile-pivot-plan
pnpm --filter @mingle/backend build 2>&1 | grep -E "error TS" | sed -E 's/\(.*//' | sort -u
```
Expected: a list of files still referencing removed fields/models (profile DTOs with `preferences`/`values`, date-plan using `profileId1/2`, admin/dashboard touching removed models, party referencing AI/round fields). This list is your worklist.

- [ ] **Step 2: Migrate the Profile module (DTO + service) — TDD**

Write the failing test first — `apps/backend/src/profile/profile.service.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { ProfileService } from "./profile.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ProfileService (v2 shape)", () => {
  it("creates a profile with v2 fields and no v1 fields", async () => {
    const created = { id: "p1", partyPreferenceText: "조용한 보드게임 모임" };
    const prisma = { profile: { create: jest.fn().mockResolvedValue(created) } };
    const moduleRef = await Test.createTestingModule({
      providers: [ProfileService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = moduleRef.get(ProfileService);

    const dto = {
      name: "A", age: 27, gender: "female", occupation: "designer",
      partyPreferenceText: "조용한 보드게임 모임",
    } as any;
    await service.create("user-1", dto);

    const arg = prisma.profile.create.mock.calls[0][0].data;
    expect(arg.partyPreferenceText).toBe("조용한 보드게임 모임");
    expect(arg.occupation).toBe("designer");
    expect(arg).not.toHaveProperty("agentPersona");
    expect(arg).not.toHaveProperty("communicationStyle");
    expect(arg).not.toHaveProperty("values");
  });
});
```

Run (expect FAIL — compile error or assertion): `pnpm --filter @mingle/backend test -- profile.service`

Then edit `create-profile.dto.ts`/`update-profile.dto.ts` to the v2 fields (`name`, `age`, `gender`, `occupation` required; `partyPreferenceText` required; `bio?`, `location?`, `photoUrl?`, `interests?` optional; remove `preferences`/`values`/`communicationStyle`) and `profile.service.ts` to persist only v2 fields. Re-run the test → PASS.

- [ ] **Step 3: Migrate Party (skeleton), DatePlan (matchId)**

- `apps/backend/src/party/party.service.ts`: keep only `findOne(id)` and `findMany(...)` using the v2 `Party` model; remove anything referencing `roundCount`/`scheduledAt`/`results`/AI. `party.controller.ts`: keep only GET routes. Drop AI/round fields from `dto/create-party.dto.ts` (or delete the create route if party creation is Phase 2 — leave a typed `findMany` filter only).
- `apps/backend/src/date-plan/`: change queries/DTO from `profileId1/profileId2` to `matchId` (the v2 `DatePlan.matchId`).

Verify these two modules type-check by re-running the Step 1 build grep — their files should drop off the error list.

- [ ] **Step 4: Migrate Admin, Dashboard, and Safety(+Block) — TDD for Block**

- `admin/`: remove report-management actions; keep user/party/safety management; fix any remaining type errors.
- `dashboard/`: remove reservation/report stats; keep what compiles against v2 (e.g. party counts).
- `safety/`: add Block support. Write the failing test first — append to `apps/backend/src/safety/safety.service.spec.ts` (create the file if absent):

```ts
it("creates a block between two profiles", async () => {
  const prisma = { block: { create: jest.fn().mockResolvedValue({ id: "b1" }) } } as any;
  const service = new SafetyService(prisma);
  await service.createBlock("blocker-1", "blocked-2");
  expect(prisma.block.create).toHaveBeenCalledWith({
    data: { blockerProfileId: "blocker-1", blockedProfileId: "blocked-2" },
  });
});
```
Run (expect FAIL: `createBlock` undefined). Then add to `safety.service.ts`:
```ts
createBlock(blockerProfileId: string, blockedProfileId: string) {
  return this.prisma.block.create({ data: { blockerProfileId, blockedProfileId } });
}
listBlocks(profileId: string) {
  return this.prisma.block.findMany({ where: { blockerProfileId: profileId } });
}
```
(Adjust the constructor/`SafetyService` instantiation in the test to match its real signature.) Re-run → PASS. Expose via `safety.controller.ts` only if trivial; otherwise leave service-level for now.

- [ ] **Step 5: Full backend green gate**

```bash
pnpm --filter @mingle/backend build
pnpm --filter @mingle/backend test
docker compose up -d && pnpm --filter @mingle/backend exec prisma generate
node -e "require('child_process').execSync('node dist/main.js',{cwd:'apps/backend',timeout:8000,stdio:'inherit'})" 2>&1 | head -20 || true
```
Expected: `nest build` clean (zero TS errors); Jest green; the boot line prints Nest startup logs ("Nest application successfully started" or the listening message) — kill after confirming it boots. If boot needs envs, run with the `.env` already configured for backend.

- [ ] **Step 6: Commit**

```bash
git add apps/backend
git commit -m "refactor(backend): migrate surviving modules to v2 schema (profile/party/date-plan/admin/dashboard/safety+block)"
```

---

## Task 5: Scaffold new domain skeletons + wire AppModule

Add the empty NestJS modules for the new domains and register them. Purely additive — backend stays green. This is the structural foundation feature phases (2–4) will fill.

**Files:**
- Create: `apps/backend/src/matchmaking/matchmaking.module.ts`, `matchmaking.service.ts`; same trio of `module.ts`+`service.ts` for `proposal/`, `match/`, `messenger/`.
- Modify: `apps/backend/src/app.module.ts` (register the four modules).

**Interfaces:**
- Consumes: `PrismaService` (via `PrismaModule`).
- Produces: four registered modules, each exporting an injectable service with no business methods yet (placeholder). AppModule imports all four.

- [ ] **Step 1: Create one skeleton module (matchmaking) as the template**

`apps/backend/src/matchmaking/matchmaking.service.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MatchmakingService {
  constructor(private readonly prisma: PrismaService) {}
  // Phase 2: queue enqueue/cancel + similarity grouping → party creation.
}
```
`apps/backend/src/matchmaking/matchmaking.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MatchmakingService } from "./matchmaking.service";

@Module({
  imports: [PrismaModule],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
```

- [ ] **Step 2: Create the other three skeletons**

Repeat Step 1's two files for `proposal/` (`ProposalService`/`ProposalModule`, comment "Phase 4: send/accept/decline → Match"), `match/` (`MatchService`/`MatchModule`, comment "Phase 4: create from accepted proposal, open DM room"), and `messenger/` (`MessengerService`/`MessengerModule`, comment "Phase 4: 1:1 direct messages"). Each is the same shape, swapping the names.

- [ ] **Step 3: Register the four modules in AppModule**

Edit `apps/backend/src/app.module.ts`: add `import` lines for `MatchmakingModule`, `ProposalModule`, `MatchModule`, `MessengerModule` and add them to the `imports` array.

- [ ] **Step 4: Verify green (build + boot + tests)**

```bash
cd /Users/namuneulbo/Desktop/mingles/.claude/worktrees/mobile-pivot-plan
pnpm --filter @mingle/backend build
pnpm --filter @mingle/backend test
docker compose up -d && node -e "require('child_process').execSync('node dist/main.js',{cwd:'apps/backend',timeout:8000,stdio:'inherit'})" 2>&1 | head -20 || true
```
Expected: build clean; tests green; boot logs show the four new modules' dependencies initialized and "Nest application successfully started". Confirm `@mingle/shared` still builds and `apps/mobile`/`@mingle/client-core` are untouched.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src
git commit -m "feat(backend): scaffold matchmaking/proposal/match/messenger skeleton modules"
```

---

## Self-Review

**1. Spec coverage (against `2026-06-29-phase1-data-model-v2-design.md`):**
- §3 schema (Profile/Party/DatePlan changes + 8 new models + 2 removed) → Task 3 (schema) consuming the spec verbatim. ✅
- §4 remove obsolete code (report/reservation/party-gateway/AI/common DTOs) → Task 1. ✅
- §4 adjust surviving modules (profile/party/date-plan/admin/dashboard/safety+Block) → Task 4. ✅
- §4 new skeleton modules (matchmaking/proposal/match/messenger) → Task 5. ✅
- §4 `@mingle/shared` v2 → Task 2. ✅
- §5 clean-reset migration → Task 3. ✅
- §6 completion gates (prisma validate, nest build, boot, tests, shared build, mobile untouched) → Task 3 Step 2 + Task 4 Step 5 + Task 5 Step 4. ✅
- §2 boundary (don't chase web/mcp; mobile stays green) → Global Constraints + Task 5 Step 4. ✅

**2. Placeholder scan:** No "TBD/handle edge cases". The new skeleton services intentionally have a one-line Phase-N comment (that is the deliverable, not a placeholder). Task 3 references the spec's §3 for the full schema by design (single source of truth, avoids drift) rather than re-inlining 200 lines — the spec is a committed, complete artifact.

**3. Type consistency:** v2 type names are consistent across tasks — `partyPreferenceText`, `preferenceSignals`, `Party.status` (matching|active|ended), `DatePlan.matchId`, `Proposal`/`Match`/`Block`/`MatchmakingQueueEntry`/`DirectMessage(Room)`/`PartyMessage`/`GameSession`, `SafetyService.createBlock(blockerProfileId, blockedProfileId)` — all match the spec §3 names. The shared `Proposal`/`Match`/`Block` shapes (Task 2) mirror the Prisma models (Task 3).

**4. Risks flagged for the executor:**
- The backend build is **expected red between Task 3 and Task 4** — that is by design (atomic schema flip). Do not "fix" it inside Task 3.
- Prisma migrate/generate and backend boot require a running Postgres (`docker compose up -d`). If Docker/Postgres is unavailable, Tasks 1/3/4/5 verification is BLOCKED — report it rather than skipping verification.
- `prisma migrate dev` may prompt for data-loss confirmation; if non-interactive, use `prisma migrate reset --force` then `migrate dev --name v2_baseline`.
- Removing report/reservation from `admin`/`dashboard` changes their API surface; `apps/web` will break against it — that is in-scope-to-ignore per the boundary, not a failure.
