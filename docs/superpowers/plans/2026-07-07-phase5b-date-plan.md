# Phase 5b — DatePlan Agreement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing DatePlan course generator into a two-person propose → select → confirm flow — hardened backend (membership + block authz, `matchId` guard, IDOR fix), new select/confirm/cancel endpoints with best-effort notifications, client-core wrappers, and a mobile `date-plan/[matchId]` screen entered from the 1:1 chat.

**Architecture:** Reuse the hardcoded 3-course generator untouched. Add `creatorProfileId`/`confirmedAt` to `DatePlan`. Every route is membership-bound (caller's profile ∈ the plan's Match) + block-gated; `select` = creator only, `confirm` = the peer (status-guarded `draft → confirmed`), `cancel` = either. Notifications reuse the `reservation` type and ride Phase-5a push; mobile taps deep-link to the plan.

**Tech Stack:** NestJS 10 + Prisma/PostgreSQL (jest), `@mingle/shared` (dual-package ESM/CJS), `@mingle/client-core` (Vitest), React Native + Expo Router (mobile, Vitest for pure libs).

## Global Constraints

- **Every date-plan route is membership-bound** — the caller's profile (resolved `prisma.profile.findUnique({ where: { userId } })`, `userId` from JWT `@CurrentUser().userId`) must be one of the plan's `Match.profileId1/profileId2`, else `403`. **Block-gated:** `isBlockedBetween(profileId1, profileId2)` → `403` on create/select/confirm/cancel/get.
- **Role separation:** `select` = creator only (`myProfileId === plan.creatorProfileId`); `confirm` = the peer only (`myProfileId !== plan.creatorProfileId`); a null `creatorProfileId` (legacy row) is not `select`/`confirm`-able.
- **Notifications best-effort NON-FATAL** (try/catch + Nest `Logger`, never rethrow) — reuse the existing `"reservation"` notification `type`; payload `data: { datePlanId, matchId }`.
- **Do NOT touch:** the hardcoded `VENUE_TEMPLATES`/`COURSE_THEMES`/`buildCourse` generator; the unused `merchantPayKey`/`paymentId`/`paymentStatus`/`paymentAmount` columns; the legacy web DatePlan UI (`apps/web/.../date-plans`).
- Mobile: typed-route OBJECT form for dynamic routes; plain RN + `StyleSheet`, **pure black & white, no Material/chroma**; reuse the auth-store `myProfileId` (set since Phase 4).
- Migration is **user-run** (`pnpm prisma:migrate` from `apps/backend`; AI `prisma migrate` is classifier-blocked). `pnpm prisma:generate` (AI-allowed) yields the typed client for build/unit tests; real DB migration is needed only for boot-query/live-E2E.
- `pnpm --filter @mingle/shared build` before backend/client-core (dual-package). ANSI-safe TS check: `... 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error"`.
- Prettier: double quotes, `trailingComma: all`, `printWidth: 100`, semicolons. TS strict.

---

## File Structure

- `apps/backend/prisma/schema.prisma` — `DatePlan.creatorProfileId` + `confirmedAt` (Task 1).
- `packages/shared/src/types/date-plan.ts` — `DatePlan` additions, `DatePlanStatus` + `"cancelled"`, `DatePlanView` (Task 2).
- `apps/backend/src/date-plan/date-plan.service.ts` — `memberContext`, hardened `create`, `getOne`, `listForMatch`, `toView` (Task 3); `select`/`confirm`/`cancel` + notify (Task 4).
- `apps/backend/src/date-plan/date-plan.controller.ts` — route wiring (Tasks 3 & 4).
- `apps/backend/src/date-plan/date-plan.module.ts` — import `SafetyModule` (Task 3), `NotificationModule` (Task 4).
- `apps/backend/src/date-plan/dto/select-course.dto.ts` — `{ courseId }` (Task 4).
- `packages/client-core/src/api/date-plans.ts` + `index.ts` — 6 wrappers (Task 5).
- `apps/mobile/app/(app)/date-plan/[matchId].tsx` — the screen (Task 6); `chat/[roomId].tsx` — header entry (Task 6).
- `apps/mobile/src/lib/route-for-notification.ts` — `reservation` → date-plan (Task 7).

---

### Task 1: Schema — `creatorProfileId` + `confirmedAt`

**Files:** Modify `apps/backend/prisma/schema.prisma` (`model DatePlan`).

**Interfaces:** Produces `DatePlan.creatorProfileId: string | null`, `DatePlan.confirmedAt: DateTime | null` on the Prisma client.

- [ ] **Step 1: Add two nullable columns** inside `model DatePlan { ... }`, after `selectedCourseId`:

```prisma
  creatorProfileId String?   @map("creator_profile_id")
  confirmedAt      DateTime? @map("confirmed_at")
```

(Nullable so the migration succeeds on any existing rows; plain scalars — no relation/FK, they are only compared against `match.profileId1/2`.)

- [ ] **Step 2: Ask the user to run the migration** (AI cannot). Post this and WAIT:

> Run from `apps/backend`: `pnpm prisma:migrate --name phase5b_date_plan_agreement`.

- [ ] **Step 3: Generate the client** (AI-allowed): from `apps/backend`, `pnpm prisma:generate`. Confirm: `find . -path '*/.prisma/client/index.d.ts' | head -1 | xargs grep -c "creatorProfileId"` → `> 0`.

- [ ] **Step 4: Verify build** (ANSI-safe): `pnpm --filter @mingle/shared build >/dev/null 2>&1 && pnpm --filter @mingle/backend build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN` → `CLEAN`.

- [ ] **Step 5: Commit** (schema only — the migration file is committed later, after the user runs it):

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(date-plan): DatePlan.creatorProfileId + confirmedAt (Phase 5b)"
```

---

### Task 2: shared types — `DatePlanView`, `cancelled`, model fields

**Files:** Modify `packages/shared/src/types/date-plan.ts`.

**Interfaces:** Produces `DatePlanView`, `DatePlanStatus` (with `"cancelled"`), `DatePlan.creatorProfileId?`/`confirmedAt?` — consumed by backend (Task 3/4) and client-core (Task 5).

- [ ] **Step 1: Edit `date-plan.ts`** — update the status union, extend `DatePlan`, add `DatePlanView`:

```ts
export type DatePlanStatus = "draft" | "confirmed" | "cancelled" | "completed";

export interface DatePlan {
  id: string;
  matchId: string;
  creatorProfileId?: string | null;
  constraints: DateConstraints;
  courses: DateCourse[];
  status: DatePlanStatus;
  selectedCourseId?: string;
  confirmedAt?: string | null;
  merchantPayKey?: string;
  paymentId?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  createdAt: string;
}

/** API projection — no payment fields exposed. */
export interface DatePlanView {
  id: string;
  matchId: string;
  creatorProfileId: string | null;
  constraints: DateConstraints;
  courses: DateCourse[];
  status: DatePlanStatus;
  selectedCourseId: string | null;
  confirmedAt: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Confirm the barrel exports it.** `packages/shared/src/index.ts` re-exports `./types/date-plan.js` with `export type { ... }` — ensure `DatePlanView` is included in that export list (add it if the list is explicit).

- [ ] **Step 3: Build shared** (dual-package): `pnpm --filter @mingle/shared build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN` → `CLEAN`. Confirm both `dist/types/date-plan.d.ts` and `dist/cjs/types/date-plan.d.ts` mention `DatePlanView`.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/date-plan.ts packages/shared/src/index.ts
git commit -m "feat(shared): DatePlanView + cancelled status + creator/confirmedAt fields"
```

---

### Task 3: Backend — membership guard + hardened create + authorized reads

**Files:**
- Modify `apps/backend/src/date-plan/date-plan.service.ts` (add `memberContext`, `toView`; harden `create`; add `getOne`, `listForMatch`)
- Modify `apps/backend/src/date-plan/date-plan.controller.ts` (auth on GET, pass userId, add list route)
- Modify `apps/backend/src/date-plan/date-plan.module.ts` (import `SafetyModule`)
- Modify `apps/backend/src/date-plan/date-plan.service.spec.ts` (create if absent)

**Interfaces:**
- Consumes: `SafetyService.isBlockedBetween(a, b): Promise<boolean>` (`../safety/safety.service`), `JwtAuthGuard`, `CurrentUser`/`JwtPayload` (`../common/decorators/current-user.decorator`, field `userId`).
- Produces: `memberContext(userId, datePlanId) → { plan, match, myProfileId, peerProfileId }`; `create(userId, dto)`; `getOne(userId, id): DatePlanView`; `listForMatch(userId, matchId): DatePlanView[]`; `toView(plan): DatePlanView`. Consumed by Task 4.

- [ ] **Step 1: Write the failing test** — `date-plan.service.spec.ts` (mock prisma + safety):

```ts
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { DatePlanService } from "./date-plan.service";

const MATCH = { id: "m1", profileId1: "pA", profileId2: "pB" };
function make(over: { plan?: any; profile?: any; blocked?: boolean } = {}) {
  const prisma = {
    match: { findUnique: jest.fn().mockResolvedValue(MATCH) },
    profile: { findUnique: jest.fn().mockResolvedValue(over.profile ?? { id: "pA", userId: "uA" }) },
    datePlan: {
      findUnique: jest.fn().mockResolvedValue(
        over.plan ?? { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: [], selectedCourseId: null },
      ),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => ({ id: "d1", ...data })),
    },
  } as any;
  const safety = { isBlockedBetween: jest.fn().mockResolvedValue(over.blocked ?? false) } as any;
  const notifications = { create: jest.fn().mockResolvedValue({}) } as any;
  return { svc: new DatePlanService(prisma, safety, notifications), prisma, safety };
}

it("memberContext resolves member + peer", async () => {
  const { svc } = make({ profile: { id: "pA", userId: "uA" } });
  const ctx = await svc.memberContext("uA", "d1");
  expect(ctx.myProfileId).toBe("pA");
  expect(ctx.peerProfileId).toBe("pB");
});

it("memberContext 403 for a non-member", async () => {
  const { svc } = make({ profile: { id: "pX", userId: "uX" } });
  await expect(svc.memberContext("uX", "d1")).rejects.toBeInstanceOf(ForbiddenException);
});

it("memberContext 403 when blocked", async () => {
  const { svc } = make({ blocked: true });
  await expect(svc.memberContext("uA", "d1")).rejects.toBeInstanceOf(ForbiddenException);
});

it("create sets creatorProfileId + guards a missing match", async () => {
  const { svc, prisma } = make();
  const dto = { matchId: "m1", budget: { total: 100000 }, location: { city: "서울" }, dateTime: { preferredDate: "2026-08-01" } };
  const plan = await svc.create("uA", dto as any);
  expect(plan.creatorProfileId).toBe("pA");
  prisma.match.findUnique.mockResolvedValueOnce(null);
  await expect(svc.create("uA", dto as any)).rejects.toBeInstanceOf(NotFoundException);
});

it("getOne returns a view without payment fields", async () => {
  const { svc } = make();
  const view = await svc.getOne("uA", "d1");
  expect(view).not.toHaveProperty("merchantPayKey");
  expect(view).toHaveProperty("status", "draft");
});
```

- [ ] **Step 2: Run to fail** — `pnpm --filter @mingle/backend exec jest date-plan.service 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|Cannot find"` → FAIL.

- [ ] **Step 3: Edit `date-plan.service.ts`** — imports, constructor, and the new/hardened methods. Update the top:

```ts
import { Injectable, Logger, NotFoundException, ForbiddenException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { SafetyService } from "../safety/safety.service";
import { NotificationService } from "../notification/notification.service";
import { CreateDatePlanDto } from "./dto/create-date-plan.dto";
import type { DateCourse, DateStop, DateConstraints, DatePlanView } from "@mingle/shared";
```

Constructor (inject Safety + Notification now — Task 4 uses notifications; wiring both here avoids a second constructor edit):

```ts
  private readonly log = new Logger(DatePlanService.name);
  constructor(
    private prisma: PrismaService,
    private readonly safety: SafetyService,
    private readonly notifications: NotificationService,
  ) {}
```

Add `toView` + `memberContext` + `getOne` + `listForMatch`, and change `create` to take `userId` and set `creatorProfileId`:

```ts
  toView(plan: {
    id: string; matchId: string; creatorProfileId: string | null;
    constraints: unknown; courses: unknown; status: string;
    selectedCourseId: string | null; confirmedAt: Date | null; createdAt: Date;
  }): DatePlanView {
    return {
      id: plan.id,
      matchId: plan.matchId,
      creatorProfileId: plan.creatorProfileId ?? null,
      constraints: plan.constraints as DateConstraints,
      courses: plan.courses as DateCourse[],
      status: plan.status as DatePlanView["status"],
      selectedCourseId: plan.selectedCourseId ?? null,
      confirmedAt: plan.confirmedAt ? plan.confirmedAt.toISOString() : null,
      createdAt: plan.createdAt.toISOString(),
    };
  }

  async memberContext(userId: string, datePlanId: string) {
    const plan = await this.prisma.datePlan.findUnique({ where: { id: datePlanId } });
    if (!plan) throw new NotFoundException(`데이트 플랜을 찾을 수 없습니다: ${datePlanId}`);
    const match = await this.prisma.match.findUnique({ where: { id: plan.matchId } });
    if (!match) throw new NotFoundException("매치를 찾을 수 없습니다");
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me || (me.id !== match.profileId1 && me.id !== match.profileId2)) {
      throw new ForbiddenException("이 데이트 플랜에 접근할 수 없습니다");
    }
    if (await this.safety.isBlockedBetween(match.profileId1, match.profileId2)) {
      throw new ForbiddenException("차단된 상대와는 데이트 플랜을 진행할 수 없습니다");
    }
    const peerProfileId = me.id === match.profileId1 ? match.profileId2 : match.profileId1;
    return { plan, match, myProfileId: me.id, peerProfileId };
  }

  async getOne(userId: string, id: string): Promise<DatePlanView> {
    const { plan } = await this.memberContext(userId, id);
    return this.toView(plan);
  }

  async listForMatch(userId: string, matchId: string): Promise<DatePlanView[]> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException("매치를 찾을 수 없습니다");
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me || (me.id !== match.profileId1 && me.id !== match.profileId2)) {
      throw new ForbiddenException("이 매치에 접근할 수 없습니다");
    }
    if (await this.safety.isBlockedBetween(match.profileId1, match.profileId2)) {
      throw new ForbiddenException("차단된 상대입니다");
    }
    const plans = await this.prisma.datePlan.findMany({
      where: { matchId },
      orderBy: { createdAt: "desc" },
    });
    return plans.map((p) => this.toView(p));
  }
```

Change the `create` signature + guards (keep the entire existing constraints/courses generation body unchanged — only add the guards at the top and `creatorProfileId` in the `data`):

```ts
  async create(userId: string, dto: CreateDatePlanDto) {
    const match = await this.prisma.match.findUnique({ where: { id: dto.matchId } });
    if (!match) throw new NotFoundException(`매치를 찾을 수 없습니다: ${dto.matchId}`);
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me || (me.id !== match.profileId1 && me.id !== match.profileId2)) {
      throw new ForbiddenException("이 매치의 참여자만 데이트 플랜을 만들 수 있습니다");
    }
    if (await this.safety.isBlockedBetween(match.profileId1, match.profileId2)) {
      throw new ForbiddenException("차단된 상대와는 데이트 플랜을 만들 수 없습니다");
    }
    // ---- existing constraints + courses generation stays exactly as-is ----
    // (const constraints = ...; const courses = ...; the fallback block)
    return this.prisma.datePlan.create({
      data: {
        matchId: dto.matchId,
        creatorProfileId: me.id,
        constraints: constraints as object,
        courses: courses as object[],
        status: "draft",
      },
    });
  }
```

Delete the old `findOne` (replaced by `getOne`) — or keep it private if referenced elsewhere (grep: it is only used by the controller, which Step 4 rewires). Remove it.

- [ ] **Step 4: Rewire `date-plan.controller.ts`**:

```ts
import { Controller, Get, Post, Param, Query, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { DatePlanService } from "./date-plan.service";
import { CreateDatePlanDto } from "./dto/create-date-plan.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtPayload } from "../common/decorators/current-user.decorator";

@ApiTags("Date Plans")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("date-plans")
export class DatePlanController {
  constructor(private datePlanService: DatePlanService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDatePlanDto) {
    return this.datePlanService.create(user.userId, dto);
  }

  @Get()
  listForMatch(@CurrentUser() user: JwtPayload, @Query("matchId") matchId: string) {
    return this.datePlanService.listForMatch(user.userId, matchId);
  }

  @Get(":id")
  getOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.datePlanService.getOne(user.userId, id);
  }
}
```

(Class-level `@UseGuards(JwtAuthGuard)` now protects `GET /:id` — closes the IDOR. `POST` no longer needs its own guard.)

- [ ] **Step 5: Import `SafetyModule` + `NotificationModule`** in `date-plan.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { DatePlanController } from "./date-plan.controller";
import { DatePlanService } from "./date-plan.service";
import { SafetyModule } from "../safety/safety.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [SafetyModule, NotificationModule],
  controllers: [DatePlanController],
  providers: [DatePlanService],
  exports: [DatePlanService],
})
export class DatePlanModule {}
```

- [ ] **Step 6: Run tests + full suite + build.**

Run: `pnpm --filter @mingle/backend exec jest date-plan.service 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|FAIL"` → pass.
Run: `pnpm --filter @mingle/backend test 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|Suites:|FAIL"` → all pass.
Run: the ANSI-safe backend build → CLEAN. Boot: `NotificationModule`/`SafetyModule` already app-registered; confirm `Nest application successfully started` + `Mapped {/date-plans, GET}`.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/date-plan
git commit -m "feat(date-plan): membership+block authz, matchId guard, IDOR fix, creator + list"
```

---

### Task 4: Backend — select / confirm / cancel + notifications

**Files:**
- Modify `apps/backend/src/date-plan/date-plan.service.ts` (add `select`, `confirm`, `cancel`, `notify`)
- Modify `apps/backend/src/date-plan/date-plan.controller.ts` (3 PATCH routes)
- Create `apps/backend/src/date-plan/dto/select-course.dto.ts`
- Modify `apps/backend/src/date-plan/date-plan.service.spec.ts`

**Interfaces:**
- Consumes: `memberContext`, `toView` (Task 3); `NotificationService.create({ userId, type, title, message, data })`.
- Produces: `select(userId, id, courseId)`, `confirm(userId, id)`, `cancel(userId, id)` → all `DatePlanView`; routes `PATCH /date-plans/:id/select|confirm|cancel`.

- [ ] **Step 1: Write the failing test** — append to `date-plan.service.spec.ts`:

```ts
import { BadRequestException, ConflictException } from "@nestjs/common";

function makeWith(plan: any, profile: any) {
  const prisma = {
    match: { findUnique: jest.fn().mockResolvedValue(MATCH) },
    profile: { findUnique: jest.fn().mockResolvedValue(profile) },
    datePlan: {
      findUnique: jest.fn().mockResolvedValue(plan),
      update: jest.fn().mockImplementation(({ data }) => ({ ...plan, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as any;
  const safety = { isBlockedBetween: jest.fn().mockResolvedValue(false) } as any;
  const notifications = { create: jest.fn().mockResolvedValue({}) } as any;
  return { svc: new DatePlanService(prisma, safety, notifications), prisma, notifications };
}
const COURSES = [{ courseId: "c1", label: "x", stops: [], totalEstimatedCost: 0, totalEstimatedMinutes: 0 }];

it("select: creator sets a valid course + notifies the peer", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: null, confirmedAt: null, createdAt: new Date() };
  const { svc, notifications } = makeWith(plan, { id: "pA", userId: "uA" });
  const view = await svc.select("uA", "d1", "c1");
  expect(view.selectedCourseId).toBe("c1");
  expect(notifications.create).toHaveBeenCalled();
});

it("select: rejects a non-creator", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: null, confirmedAt: null, createdAt: new Date() };
  const { svc } = makeWith(plan, { id: "pB", userId: "uB" });
  await expect(svc.select("uB", "d1", "c1")).rejects.toBeInstanceOf(ForbiddenException);
});

it("select: rejects an unknown courseId", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: null, confirmedAt: null, createdAt: new Date() };
  const { svc } = makeWith(plan, { id: "pA", userId: "uA" });
  await expect(svc.select("uA", "d1", "zzz")).rejects.toBeInstanceOf(BadRequestException);
});

it("confirm: peer confirms draft→confirmed + notifies creator", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: "c1", confirmedAt: null, createdAt: new Date() };
  const { svc, prisma, notifications } = makeWith(plan, { id: "pB", userId: "uB" });
  prisma.datePlan.findUnique.mockResolvedValueOnce(plan).mockResolvedValueOnce({ ...plan, status: "confirmed", confirmedAt: new Date() });
  const view = await svc.confirm("uB", "d1");
  expect(prisma.datePlan.updateMany).toHaveBeenCalledWith({ where: { id: "d1", status: "draft" }, data: expect.objectContaining({ status: "confirmed" }) });
  expect(view.status).toBe("confirmed");
  expect(notifications.create).toHaveBeenCalled();
});

it("confirm: creator cannot self-confirm", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: "c1", confirmedAt: null, createdAt: new Date() };
  const { svc } = makeWith(plan, { id: "pA", userId: "uA" });
  await expect(svc.confirm("uA", "d1")).rejects.toBeInstanceOf(ForbiddenException);
});

it("confirm: double-confirm is idempotent (count 0 but already confirmed)", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: "c1", confirmedAt: null, createdAt: new Date() };
  const { svc, prisma } = makeWith(plan, { id: "pB", userId: "uB" });
  prisma.datePlan.updateMany.mockResolvedValueOnce({ count: 0 });
  prisma.datePlan.findUnique.mockResolvedValueOnce(plan).mockResolvedValueOnce({ ...plan, status: "confirmed", confirmedAt: new Date() });
  const view = await svc.confirm("uB", "d1");
  expect(view.status).toBe("confirmed");
});

it("confirm: still returns the row when notify throws (non-fatal)", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: "c1", confirmedAt: null, createdAt: new Date() };
  const { svc, prisma, notifications } = makeWith(plan, { id: "pB", userId: "uB" });
  notifications.create.mockRejectedValue(new Error("down"));
  prisma.datePlan.findUnique.mockResolvedValueOnce(plan).mockResolvedValueOnce({ ...plan, status: "confirmed", confirmedAt: new Date() });
  await expect(svc.confirm("uB", "d1")).resolves.toHaveProperty("status", "confirmed");
});

it("cancel: a member cancels → cancelled", async () => {
  const plan = { id: "d1", matchId: "m1", creatorProfileId: "pA", status: "draft", courses: COURSES, selectedCourseId: null, confirmedAt: null, createdAt: new Date() };
  const { svc } = makeWith(plan, { id: "pB", userId: "uB" });
  const view = await svc.cancel("uB", "d1");
  expect(view.status).toBe("cancelled");
});
```

- [ ] **Step 2: Run to fail** — `jest date-plan.service` → the new cases FAIL.

- [ ] **Step 3: Create `dto/select-course.dto.ts`**:

```ts
import { IsString, IsNotEmpty } from "class-validator";

export class SelectCourseDto {
  @IsString()
  @IsNotEmpty()
  courseId!: string;
}
```

- [ ] **Step 4: Add the methods to `date-plan.service.ts`** (uses `memberContext`/`toView` from Task 3; `DateCourse` already imported):

```ts
  async select(userId: string, id: string, courseId: string): Promise<DatePlanView> {
    const { plan, myProfileId, peerProfileId } = await this.memberContext(userId, id);
    if (!plan.creatorProfileId || myProfileId !== plan.creatorProfileId) {
      throw new ForbiddenException("코스는 플랜을 만든 사람만 선택할 수 있습니다");
    }
    if (plan.status !== "draft") throw new ConflictException("이미 확정되었거나 취소된 플랜입니다");
    const courses = plan.courses as unknown as DateCourse[];
    if (!courses.some((c) => c.courseId === courseId)) {
      throw new BadRequestException("존재하지 않는 코스입니다");
    }
    const updated = await this.prisma.datePlan.update({ where: { id }, data: { selectedCourseId: courseId } });
    await this.notify(peerProfileId, id, plan.matchId, "새 데이트 플랜", "매칭 상대가 데이트 코스를 제안했어요. 확인해 보세요!");
    return this.toView(updated);
  }

  async confirm(userId: string, id: string): Promise<DatePlanView> {
    const { plan, myProfileId } = await this.memberContext(userId, id);
    if (!plan.creatorProfileId) throw new ConflictException("확정할 수 없는 플랜입니다");
    if (myProfileId === plan.creatorProfileId) {
      throw new ForbiddenException("데이트 플랜은 상대방이 확정해야 합니다");
    }
    if (!plan.selectedCourseId) throw new ConflictException("먼저 코스가 선택되어야 합니다");
    const res = await this.prisma.datePlan.updateMany({
      where: { id, status: "draft" },
      data: { status: "confirmed", confirmedAt: new Date() },
    });
    if (res.count === 0) {
      const fresh = await this.prisma.datePlan.findUnique({ where: { id } });
      if (fresh?.status === "confirmed") return this.toView(fresh);
      throw new ConflictException("확정할 수 없는 상태입니다");
    }
    const updated = await this.prisma.datePlan.findUnique({ where: { id } });
    await this.notify(plan.creatorProfileId, id, plan.matchId, "데이트 플랜 확정", "매칭 상대가 데이트 플랜을 확정했어요!");
    return this.toView(updated!);
  }

  async cancel(userId: string, id: string): Promise<DatePlanView> {
    const { plan } = await this.memberContext(userId, id);
    if (plan.status === "cancelled" || plan.status === "completed") {
      throw new ConflictException("이미 취소되었거나 완료된 플랜입니다");
    }
    const updated = await this.prisma.datePlan.update({ where: { id }, data: { status: "cancelled" } });
    return this.toView(updated);
  }

  /** Best-effort, non-fatal notification to a profile's owning user. */
  private async notify(targetProfileId: string, datePlanId: string, matchId: string, title: string, message: string) {
    try {
      const p = await this.prisma.profile.findUnique({ where: { id: targetProfileId }, select: { userId: true } });
      if (!p) return;
      await this.notifications.create({
        userId: p.userId,
        type: "reservation",
        title,
        message,
        data: { datePlanId, matchId },
      });
    } catch (err) {
      this.log.warn(`date-plan notify failed for profile ${targetProfileId}: ${err}`);
    }
  }
```

Add `BadRequestException, ConflictException` to the `@nestjs/common` import.

- [ ] **Step 5: Add the PATCH routes** to `date-plan.controller.ts`:

```ts
import { Patch } from "@nestjs/common";
import { SelectCourseDto } from "./dto/select-course.dto";
// ...
  @Patch(":id/select")
  select(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: SelectCourseDto) {
    return this.datePlanService.select(user.userId, id, dto.courseId);
  }

  @Patch(":id/confirm")
  confirm(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.datePlanService.confirm(user.userId, id);
  }

  @Patch(":id/cancel")
  cancel(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.datePlanService.cancel(user.userId, id);
  }
```

- [ ] **Step 6: Run tests + full suite + build + boot.**

Run: `jest date-plan.service` → all pass. Full suite → all pass. ANSI-safe build → CLEAN. Boot: confirm `Mapped {/date-plans/:id/select, PATCH}`, `.../confirm`, `.../cancel` + `Nest application successfully started`.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/date-plan
git commit -m "feat(date-plan): select (creator) / confirm (peer, status-guarded) / cancel + notifications"
```

---

### Task 5: client-core — DatePlan API wrappers

**Files:**
- Create `packages/client-core/src/api/date-plans.ts`
- Modify `packages/client-core/src/index.ts`
- Create `packages/client-core/src/__tests__/date-plans-api.test.ts`

**Interfaces:**
- Consumes: `apiFetch` (`./client.js`); `DatePlanView` (`@mingle/shared`).
- Produces: `createDatePlan`, `getDatePlan`, `getDatePlansForMatch`, `selectCourse`, `confirmDatePlan`, `cancelDatePlan`, `CreateDatePlanInput`.

- [ ] **Step 1: Write the failing test** — `date-plans-api.test.ts` (mirror the `devices-api.test.ts` `vi.spyOn(client, "apiFetch")` style):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../api/client.js";
import {
  createDatePlan, getDatePlan, getDatePlansForMatch, selectCourse, confirmDatePlan, cancelDatePlan,
} from "../index.js";

const fetchMock = vi.spyOn(client, "apiFetch").mockResolvedValue(undefined as never);
beforeEach(() => fetchMock.mockClear());
const INPUT = { matchId: "m1", budget: { total: 100000 }, location: { city: "서울" }, dateTime: { preferredDate: "2026-08-01" } };

describe("date-plans API", () => {
  it("createDatePlan POSTs the input", async () => {
    await createDatePlan(INPUT as any);
    expect(fetchMock).toHaveBeenCalledWith("/date-plans", { method: "POST", body: JSON.stringify(INPUT) });
  });
  it("getDatePlan GETs by id", async () => {
    await getDatePlan("d1");
    expect(fetchMock).toHaveBeenCalledWith("/date-plans/d1");
  });
  it("getDatePlansForMatch GETs by matchId query", async () => {
    await getDatePlansForMatch("m1");
    expect(fetchMock).toHaveBeenCalledWith("/date-plans?matchId=m1");
  });
  it("selectCourse PATCHes select", async () => {
    await selectCourse("d1", "c1");
    expect(fetchMock).toHaveBeenCalledWith("/date-plans/d1/select", { method: "PATCH", body: JSON.stringify({ courseId: "c1" }) });
  });
  it("confirmDatePlan PATCHes confirm", async () => {
    await confirmDatePlan("d1");
    expect(fetchMock).toHaveBeenCalledWith("/date-plans/d1/confirm", { method: "PATCH" });
  });
  it("cancelDatePlan PATCHes cancel", async () => {
    await cancelDatePlan("d1");
    expect(fetchMock).toHaveBeenCalledWith("/date-plans/d1/cancel", { method: "PATCH" });
  });
});
```

- [ ] **Step 2: Run to fail** — `pnpm --filter @mingle/client-core test 2>&1 | grep -E "FAIL|Cannot find"` → FAIL.

- [ ] **Step 3: Implement `api/date-plans.ts`**:

```ts
import type { DatePlanView } from "@mingle/shared";
import { apiFetch } from "./client.js";

export interface CreateDatePlanInput {
  matchId: string;
  budget: { total: number; currency?: string };
  location: { city: string; district?: string; maxTravelMinutes?: number };
  dateTime: { preferredDate: string; durationHours?: number };
  preferences?: { cuisineTypes?: string[]; activityTypes?: string[]; avoidTypes?: string[] };
}

export function createDatePlan(input: CreateDatePlanInput): Promise<DatePlanView> {
  return apiFetch<DatePlanView>("/date-plans", { method: "POST", body: JSON.stringify(input) });
}

export function getDatePlan(id: string): Promise<DatePlanView> {
  return apiFetch<DatePlanView>(`/date-plans/${id}`);
}

export function getDatePlansForMatch(matchId: string): Promise<DatePlanView[]> {
  return apiFetch<DatePlanView[]>(`/date-plans?matchId=${matchId}`);
}

export function selectCourse(id: string, courseId: string): Promise<DatePlanView> {
  return apiFetch<DatePlanView>(`/date-plans/${id}/select`, { method: "PATCH", body: JSON.stringify({ courseId }) });
}

export function confirmDatePlan(id: string): Promise<DatePlanView> {
  return apiFetch<DatePlanView>(`/date-plans/${id}/confirm`, { method: "PATCH" });
}

export function cancelDatePlan(id: string): Promise<DatePlanView> {
  return apiFetch<DatePlanView>(`/date-plans/${id}/cancel`, { method: "PATCH" });
}
```

- [ ] **Step 4: Extend the barrel** `index.ts` (append, `.js` convention):

```ts
export {
  createDatePlan, getDatePlan, getDatePlansForMatch, selectCourse, confirmDatePlan, cancelDatePlan,
} from "./api/date-plans.js";
export type { CreateDatePlanInput } from "./api/date-plans.js";
```

- [ ] **Step 5: Build + test** — `pnpm --filter @mingle/shared build >/dev/null 2>&1 && pnpm --filter @mingle/client-core build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN` → CLEAN; `pnpm --filter @mingle/client-core test 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Test Files|Tests |FAIL"` → all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/client-core
git commit -m "feat(client-core): DatePlan API wrappers (create/get/list/select/confirm/cancel)"
```

---

### Task 6: Mobile — `date-plan/[matchId]` screen + chat entry

**Files:**
- Create `apps/mobile/app/(app)/date-plan/[matchId].tsx`
- Modify `apps/mobile/app/(app)/chat/[roomId].tsx` (header "데이트 플랜" action)

**Interfaces:**
- Consumes: `createDatePlan`, `getDatePlansForMatch`, `selectCourse`, `confirmDatePlan`, `cancelDatePlan`, `DatePlanView`, `CreateDatePlanInput` (Task 5); the auth store's `myProfileId`.

- [ ] **Step 1: Implement `app/(app)/date-plan/[matchId].tsx`** — a status-driven screen. Pure B&W:

```tsx
import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  getDatePlansForMatch, createDatePlan, selectCourse, confirmDatePlan, cancelDatePlan,
  type DatePlanView, type DateCourse,
} from "@mingle/client-core";
import { useAuthStore } from "../../../src/store/auth"; // adjust to the real auth-store path

const INK = "#17150F";
const GRAY = "#8A857C";
const FILL = "#F1EFE9";

export default function DatePlanScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const myProfileId = useAuthStore((s) => s.profileId);
  const [plan, setPlan] = useState<DatePlanView | null>(null);
  const [phase, setPhase] = useState<"loading" | "form" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  // create-form fields
  const [budget, setBudget] = useState("100000");
  const [city, setCity] = useState("서울");
  const [date, setDate] = useState("");

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    getDatePlansForMatch(matchId)
      .then((list) => {
        if (!alive) return;
        const active = list.find((p) => p.status !== "cancelled") ?? null;
        setPlan(active);
        setPhase(active ? "ready" : "form");
      })
      .catch(() => alive && setPhase("error"));
    return () => { alive = false; };
  }, [matchId]);

  useFocusEffect(load);

  async function onCreate() {
    setBusy(true);
    try {
      const created = await createDatePlan({
        matchId, budget: { total: Number(budget) || 0 },
        location: { city }, dateTime: { preferredDate: date || new Date().toISOString().slice(0, 10) },
      });
      setPlan(created); setPhase("ready");
    } catch { Alert.alert("오류", "플랜 생성에 실패했어요."); } finally { setBusy(false); }
  }
  async function run(fn: () => Promise<DatePlanView>) {
    setBusy(true);
    try { setPlan(await fn()); } catch { Alert.alert("오류", "요청을 처리하지 못했어요."); } finally { setBusy(false); }
  }

  if (phase === "loading") return <View style={s.center}><ActivityIndicator size="large" color={INK} /></View>;
  if (phase === "error") return <View style={s.center}><Text style={s.ink}>플랜을 불러오지 못했어요.</Text></View>;

  if (phase === "form") {
    return (
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>데이트 플랜 만들기</Text>
        <Text style={s.label}>예산(원)</Text>
        <TextInput style={s.input} value={budget} onChangeText={setBudget} keyboardType="number-pad" />
        <Text style={s.label}>지역</Text>
        <TextInput style={s.input} value={city} onChangeText={setCity} />
        <Text style={s.label}>날짜 (YYYY-MM-DD)</Text>
        <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="2026-08-01" placeholderTextColor={GRAY} />
        <Pressable style={[s.btn, busy && s.btnDisabled]} disabled={busy} onPress={onCreate}>
          <Text style={s.btnText}>{busy ? "생성 중..." : "코스 추천 받기"}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // phase === "ready" — plan exists
  const p = plan!;
  const isCreator = myProfileId != null && p.creatorProfileId === myProfileId;
  const selected = p.courses.find((c) => c.courseId === p.selectedCourseId) ?? null;

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.title}>데이트 플랜</Text>
      <Text style={s.status}>상태: {statusLabel(p.status)}</Text>

      {p.status === "draft" && !p.selectedCourseId && isCreator && (
        <>
          <Text style={s.hint}>마음에 드는 코스를 선택하세요.</Text>
          {p.courses.map((c) => (
            <CourseCard key={c.courseId} course={c}
              action={<Pressable style={s.btn} disabled={busy} onPress={() => run(() => selectCourse(p.id, c.courseId))}>
                <Text style={s.btnText}>이 코스로 선택</Text></Pressable>} />
          ))}
        </>
      )}

      {p.status === "draft" && !p.selectedCourseId && !isCreator && (
        <>
          <Text style={s.hint}>상대가 코스를 고르는 중이에요.</Text>
          {p.courses.map((c) => <CourseCard key={c.courseId} course={c} />)}
        </>
      )}

      {p.status === "draft" && p.selectedCourseId && (
        <>
          <Text style={s.hint}>{isCreator ? "상대의 확정을 기다리는 중이에요." : "이 코스로 진행할까요?"}</Text>
          {selected && <CourseCard course={selected} />}
          {!isCreator && (
            <Pressable style={[s.btn, busy && s.btnDisabled]} disabled={busy} onPress={() => run(() => confirmDatePlan(p.id))}>
              <Text style={s.btnText}>확정하기</Text></Pressable>
          )}
        </>
      )}

      {p.status === "confirmed" && (
        <>
          <Text style={s.hint}>데이트 플랜이 확정되었어요! 🎉</Text>
          {selected && <CourseCard course={selected} />}
        </>
      )}

      {p.status !== "cancelled" && p.status !== "confirmed" && (
        <Pressable style={s.cancel} disabled={busy}
          onPress={() => Alert.alert("취소", "정말 취소할까요?", [{ text: "아니요" }, { text: "취소하기", onPress: () => run(() => cancelDatePlan(p.id)) }])}>
          <Text style={s.cancelText}>플랜 취소</Text></Pressable>
      )}
    </ScrollView>
  );
}

function statusLabel(s: string) {
  return s === "draft" ? "진행 중" : s === "confirmed" ? "확정됨" : s === "cancelled" ? "취소됨" : s;
}

function CourseCard({ course, action }: { course: DateCourse; action?: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{course.label}</Text>
      <Text style={s.cardMeta}>{course.totalEstimatedCost.toLocaleString()}원 · {course.totalEstimatedMinutes}분</Text>
      {course.stops.map((st) => (
        <View key={st.order} style={s.stop}>
          <Text style={s.stopName}>{st.order}. {st.name}</Text>
          <Text style={s.stopMeta}>{st.type} · {st.estimatedCost.toLocaleString()}원 · {st.estimatedMinutes}분</Text>
          <Text style={s.stopWhy}>{st.rationale}</Text>
        </View>
      ))}
      {action}
    </View>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#FFFFFF" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" },
  ink: { color: INK },
  title: { fontSize: 22, fontWeight: "700", color: INK, marginBottom: 4 },
  status: { color: GRAY, marginBottom: 12 },
  hint: { color: INK, marginBottom: 12 },
  label: { color: INK, fontSize: 13, marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#D9D5CC", borderRadius: 8, padding: 10, color: INK },
  btn: { backgroundColor: INK, borderRadius: 8, padding: 12, alignItems: "center", marginTop: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#FFFFFF", fontWeight: "700" },
  cancel: { padding: 12, alignItems: "center", marginTop: 16 },
  cancelText: { color: GRAY },
  card: { borderWidth: 1, borderColor: "#E7E4DC", borderRadius: 10, padding: 12, marginTop: 12, backgroundColor: FILL },
  cardTitle: { fontSize: 16, fontWeight: "700", color: INK },
  cardMeta: { color: GRAY, marginBottom: 8 },
  stop: { marginTop: 8 },
  stopName: { color: INK, fontWeight: "600" },
  stopMeta: { color: GRAY, fontSize: 12 },
  stopWhy: { color: "#45413A", fontSize: 12 },
});
```

> **Verify the two imports against the real code before finishing:** (1) the auth-store path + selector for `myProfileId` — open an existing screen that reads it (Phase-4 `chat/[roomId].tsx` uses the same store) and copy its exact import + selector; the spec calls the field `profileId`. (2) `DateCourse` is exported from `@mingle/shared` (it is). Adjust the import lines to match reality; keep the logic.

- [ ] **Step 2: Add the chat-room header entry** in `apps/mobile/app/(app)/chat/[roomId].tsx`. The screen already resolves the room's `Match` (to show the peer's name); reuse that match's `id`. Add a header button (via `Stack.Screen options={{ headerRight }}` if the screen uses a Stack header, else a small in-screen button near the top) that navigates:

```tsx
import { router } from "expo-router";
// where `match` (or the resolved match id) is available:
<Pressable onPress={() => router.push({ pathname: "/(app)/date-plan/[matchId]", params: { matchId: match.id } })}>
  <Text style={{ color: "#17150F", fontWeight: "700" }}>데이트 플랜</Text>
</Pressable>
```

Wire `match.id` from the existing match resolution in that screen. If the chat screen does not currently keep the matchId in state, add it from the same lookup that yields the peer name.

- [ ] **Step 3: Verify tsc** — `pnpm --filter @mingle/shared build >/dev/null 2>&1 && pnpm --filter @mingle/client-core build >/dev/null 2>&1 && cd apps/mobile && pnpm exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN` → CLEAN. (The new `date-plan/[matchId]` route now exists, so Task 7's deep-link href will type-resolve.)

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(app)/date-plan" "apps/mobile/app/(app)/chat"
git commit -m "feat(mobile): date-plan screen (create/select/confirm/cancel) + chat entry"
```

---

### Task 7: Mobile — `routeForNotification` reservation → date-plan

**Files:**
- Modify `apps/mobile/src/lib/route-for-notification.ts`
- Modify `apps/mobile/src/lib/__tests__/route-for-notification.test.ts`

**Interfaces:** Consumes the `date-plan/[matchId]` route (Task 6). Produces the retargeted `reservation` branch.

- [ ] **Step 1: Add the failing test** — append to `route-for-notification.test.ts`:

```ts
it("routes reservation with matchId to the date-plan screen", () => {
  expect(routeForNotification({ type: "reservation", matchId: "m1" })).toEqual({
    pathname: "/(app)/date-plan/[matchId]", params: { matchId: "m1" },
  });
});
it("routes reservation without matchId to home", () => {
  expect(routeForNotification({ type: "reservation" })).toBe("/(app)/home");
});
```

- [ ] **Step 2: Run to fail** — `cd apps/mobile && pnpm exec vitest run 2>&1 | grep -E "FAIL|failed"` → the reservation case fails (currently returns `/(app)/home` for both).

- [ ] **Step 3: Update `route-for-notification.ts`** — add `matchId` to `NotificationData` and retarget the `reservation` branch:

```ts
export interface NotificationData {
  type: string;
  roomId?: string;
  proposalId?: string;
  partyId?: string;
  matchId?: string;
}
```
```ts
    case "reservation":
      return data.matchId
        ? { pathname: "/(app)/date-plan/[matchId]", params: { matchId: data.matchId } }
        : "/(app)/home";
```

- [ ] **Step 4: Run tests + tsc** — `cd apps/mobile && pnpm exec vitest run 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Test Files|Tests |FAIL"` → all pass; `pnpm exec tsc --noEmit ... || echo CLEAN` → CLEAN.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib
git commit -m "feat(mobile): route reservation notifications to the date-plan screen"
```

---

## Self-Review (completed by author)

- **Spec coverage:** schema `creatorProfileId`/`confirmedAt` (T1) · `DatePlanView`/`cancelled` (T2) · membership+block guard, `matchId` guard, IDOR fix, create-creator, list (T3) · select/confirm(status-guarded)/cancel + `reservation` notifications (T4) · client-core 6 wrappers (T5) · mobile screen + chat entry (T6) · `routeForNotification` reservation deep-link (T7). Legacy web + payment columns explicitly untouched (Global Constraints). ✓
- **Placeholder scan:** none — the only "adjust to reality" note (T6 auth-store import path) is a concrete verify-against-existing instruction with the fallback named, not a TODO.
- **Type consistency:** `memberContext → { plan, match, myProfileId, peerProfileId }` used identically T3↔T4; `DatePlanView` fields match T2↔T3(`toView`)↔T5; `select/confirm/cancel(userId,…) → DatePlanView` match service↔controller↔client-core paths; `reservation` `data:{datePlanId,matchId}` matches T4(notify)↔T7(route). ✓
- **Known deferrals (backlog):** `completed` transition; removing vestigial payment columns; web DatePlan form repair; per-type notif prefs — all out of scope per spec.
