# Phase 5b — DatePlan / Date-Plan Agreement (Design Spec)

**Status:** approved 2026-07-07 · branch `megahuni` (builds on Phases 0–5a)
**Scope:** Turn the existing DatePlan course-recommendation engine into a two-person **propose → select → confirm** flow, exposed on mobile, entered from the 1:1 chat. Harden the existing endpoints (IDOR + missing `matchId` guard). Phase 5c (mobile moderation UI) is a separate spec.

## Goal

After two users match, either can create a date plan for that match (reusing the current 3-course generator), **select** one course, and the **other** user **confirms** it (`draft → confirmed`), with in-app + push notifications at each hand-off. "Reservation" here means the pair agreeing on a course/date — **not** real restaurant booking or payment.

## Non-goals (this spec)

- Real restaurant-booking APIs, merchant data, geolocation, or a payment gateway. The DatePlan `merchantPayKey`/`paymentId`/`paymentStatus`/`paymentAmount` columns stay **untouched and unused** (removing them is a separate migration risk; leave them).
- AI/LLM course generation — the hardcoded `VENUE_TEMPLATES`/`COURSE_THEMES` engine stays as-is (v2 constraint: AI = preference analysis + matchmaking only).
- The `completed` status transition (reserved in the enum; no endpoint this phase).
- The legacy **web** DatePlan form/view (`apps/web/.../date-plans`) — it already sends `profileId1/profileId2` (v1 residue) and is broken against the `matchId` DTO. **Out of 5b scope**; the backend authz changes will make it 401/403, which is acceptable (it was already non-functional). Do NOT touch it.
- Per-type notification prefs, moderation of plan content.

## Architecture / flow

1. Matched user **A** opens the 1:1 chat → taps a **"데이트 플랜"** header action → mobile `date-plan/[matchId]` screen. If no active plan → a create form (budget/location/date, sensible defaults pre-filled).
2. `POST /date-plans` runs the existing 3-course generator; the plan records `creatorProfileId = A`, `status = "draft"`.
3. A **selects** one course (`PATCH …/select`, `{ courseId }`) → the peer **B** gets a notification ("데이트 플랜이 도착했어요").
4. B **confirms** (`PATCH …/confirm`) — only the non-creator, only when a course is selected and status is `draft` — status → `confirmed`, `confirmedAt` set → **A** gets a notification ("데이트 플랜이 확정됐어요").
5. Either party may **cancel** (`PATCH …/cancel`) → `cancelled`. The confirmed itinerary shows on the plan screen for both.

## Data model (migration — user runs `pnpm prisma:migrate`; AI-run is classifier-blocked)

`apps/backend/prisma/schema.prisma`, `model DatePlan` — add two nullable columns (nullable so the migration succeeds against any existing rows; new plans always set `creatorProfileId`):

```prisma
  creatorProfileId String?   @map("creator_profile_id")
  confirmedAt      DateTime? @map("confirmed_at")
```

- Kept as a **plain scalar** (no Prisma relation / FK) — the value is only ever compared against `match.profileId1/2`, never traversed; this avoids adding a back-relation to `Profile`.
- `status` stays a `String` (`@default("draft")`); values used: `"draft" | "confirmed" | "cancelled"` (+ `"completed"` reserved, unused). No enum change needed.
- `DirectMessageRoom.matchId` is already `@unique` (room ↔ match is 1:1) — used for the deep-link `matchId`.

## Backend — `date-plan` module

Caller identity: every route derives the caller's profile via `prisma.profile.findUnique({ where: { userId } })` (the established pattern; `userId` from JWT `sub` via `@CurrentUser()`), then authorizes against the plan's match.

**A shared guard** — `DatePlanService.memberContext(userId, datePlanId)` (or `…ForMatch(userId, matchId)`): loads the plan + its `Match` (`{ profileId1, profileId2 }`), resolves the caller's profile, throws `ForbiddenException` if the caller's profile ∉ `{ profileId1, profileId2 }`, and throws `ForbiddenException` if `isBlockedBetween(profileId1, profileId2)` (Phase-4 block invariant — a plan action between blocked users is refused). Returns `{ plan, match, myProfileId, peerProfileId }`.

Endpoints (`date-plan.controller.ts`, all `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()`):

- `POST /date-plans` — **hardened create**. Body unchanged (`CreateDatePlanDto`: `matchId`, `budget`, `location`, `dateTime`, `preferences?`). New: (a) **`matchId` existence guard** — load the match, 404 if missing; (b) **membership** — caller's profile must be in the match, else 403; (c) **block guard**; (d) set `creatorProfileId = myProfileId`. Then the existing generator builds `courses` + `constraints`; `status = "draft"`. Returns the created `DatePlanView`.
- `GET /date-plans/:id` — **add `JwtAuthGuard` + membership authz** (fixes the current public IDOR). Returns the `DatePlanView`.
- `GET /date-plans?matchId=<id>` — list the match's plans (membership-authz'd), newest first, for the mobile screen to find the active one. Returns `DatePlanView[]`.
- `PATCH /date-plans/:id/select` — body `{ courseId: string }`. Requires `plan.creatorProfileId` set; **creator only** (`myProfileId === plan.creatorProfileId`), **status must be `draft`**, `courseId` must exist in `plan.courses` (else 400). Sets `selectedCourseId`. Best-effort notify the **peer** (`reservation` type, `data: { datePlanId, matchId }`).
- `PATCH /date-plans/:id/confirm` — requires `plan.creatorProfileId` set; **peer only** (`myProfileId !== plan.creatorProfileId`, and the caller is a match member per `memberContext`), `selectedCourseId` must be set, **status must be `draft`**. Use a **status-guarded update** — `updateMany({ where: { id, status: "draft" }, data: { status: "confirmed", confirmedAt: <now> } })`. If `count === 0`, refetch: if the plan is already `confirmed`, return it (idempotent success — handles the confirmer double-tapping); otherwise throw `409 Conflict` (cancelled/not-draft). Best-effort notify the **creator** (`reservation` type, `data: { datePlanId, matchId }`).
- A **null `creatorProfileId`** (legacy plan) is not actionable via `select`/`confirm` — 409/403; such a plan can only be viewed or cancelled. New plans always set the creator, so this only guards pre-5b rows.
- `PATCH /date-plans/:id/cancel` — **either member**, status not already `cancelled`/`completed` → `status = "cancelled"`. (No notification — low value.)

Notifications fire **outside** the write / best-effort **non-fatal** (try/catch + Logger), matching the Phase-4/5a pattern; they layer on the in-app `Notification` row and ride Phase-5a push automatically (`NotificationService.create` → best-effort push).

## Notifications / Phase-5a integration

- Reuse the existing `"reservation"` notification `type` (it was defined but unused — this is its purpose). Payload `data: { datePlanId, matchId }`.
- **Update Phase-5a `routeForNotification`** (`apps/mobile/src/lib/route-for-notification.ts`): the `reservation` branch (currently `"/(app)/home"`, commented "retargeted in Phase 5b") → `data.matchId ? { pathname: "/(app)/date-plan/[matchId]", params: { matchId } } : "/(app)/home"`. Add a unit case. This makes a plan-confirmed/created push tap open the plan screen.

## Shared types (`packages/shared/src/types/date-plan.ts`)

- `DatePlan`: add `creatorProfileId?: string | null`, `confirmedAt?: string | null`.
- `DatePlanStatus`: add `"cancelled"` → `"draft" | "confirmed" | "cancelled" | "completed"`.
- Add `DatePlanView` — the API projection: `{ id, matchId, creatorProfileId, constraints, courses, status, selectedCourseId, confirmedAt, createdAt }` (no payment fields exposed). Used by all endpoints + client-core.

## client-core (`packages/client-core/src/api/date-plans.ts` + barrel)

Platform-agnostic wrappers (mirror the existing `api/*.ts` `apiFetch` pattern, `.js` barrel):
```ts
createDatePlan(input: CreateDatePlanInput): Promise<DatePlanView>;      // POST /date-plans
getDatePlan(id: string): Promise<DatePlanView>;                          // GET /date-plans/:id
getDatePlansForMatch(matchId: string): Promise<DatePlanView[]>;          // GET /date-plans?matchId=
selectCourse(id: string, courseId: string): Promise<DatePlanView>;       // PATCH /date-plans/:id/select
confirmDatePlan(id: string): Promise<DatePlanView>;                       // PATCH /date-plans/:id/confirm
cancelDatePlan(id: string): Promise<DatePlanView>;                        // PATCH /date-plans/:id/cancel
```
(`CreateDatePlanInput` mirrors the backend DTO shape.) No new client-core dependency.

## Mobile (pure black & white, plain RN — new)

- **Chat-room entry:** add a **"데이트 플랜"** header action to `apps/mobile/app/(app)/chat/[roomId].tsx`. The chat screen already resolves the room's `Match` (it derives the peer's name from the match), so `matchId` is in hand — navigate `{ pathname: "/(app)/date-plan/[matchId]", params: { matchId } }` (typed object form). If matchId isn't currently surfaced there, thread it through from the same match lookup.
- **`apps/mobile/app/(app)/date-plan/[matchId].tsx`** — state machine keyed off `getDatePlansForMatch(matchId)` (take the newest non-`cancelled` plan):
  - **none** → create form (budget total, city/district, preferred date; defaults: currency `KRW`, `durationHours` 3, `maxTravelMinutes` 30, empty preferences) → `createDatePlan`.
  - **draft, no `selectedCourseId`** → render the 3 `DateCourse` cards (label, stops timeline, total cost/min — reuse the web card's structure in RN). **Creator** sees a "이 코스로 선택" per card (`selectCourse`). **Peer** sees "제안자가 코스를 고르는 중" (read-only).
  - **draft, `selectedCourseId` set** → show the selected course. **Peer** sees "확정하기" (`confirmDatePlan`). **Creator** sees "상대의 확정을 기다리는 중".
  - **confirmed** → show the confirmed itinerary + `confirmedAt`.
  - Any active state → a "취소" action (`cancelDatePlan`), with a confirm prompt.
- Ownership in the UI is decided by comparing `plan.creatorProfileId` to the logged-in `myProfileId` (already in the auth store since Phase 4). Optimistic updates where cheap; refetch on focus.
- Pure B&W palette (INK `#17150F`, paper, grays, fills) — no Material, no chroma, consistent with Phase-4/5a screens; `Switch`/controls themed B&W.

## Error handling / security

- **Every route is membership-bound** (caller's profile ∈ the plan's match) — closes the current `GET /date-plans/:id` IDOR.
- **Role separation:** `select` = creator only; `confirm` = the peer (non-creator) only. A creator cannot self-confirm; a peer cannot re-select.
- **`matchId` existence guard** on create (404 on a missing/deleted match) — closes the orphaned-plan gap.
- **Block enforcement** (`isBlockedBetween`) on create/select/confirm/cancel/get — a plan action between blocked users is refused (Phase-4 invariant).
- **Confirm race:** status-guarded `updateMany(where status="draft")` makes a double-confirm idempotent (no Serializable tx needed at 2-user contention).
- Notifications **best-effort non-fatal** — never fail the originating write.
- `DatePlanView` exposes no payment fields, no `userId`.

## Testing

- **Backend (jest):** `memberContext` (member ✓, non-member 403, blocked 403); create (matchId 404 guard, sets creatorProfileId, membership); `select` (creator-only, draft-only, bad courseId 400, notifies peer); `confirm` (peer-only, must have selection, status-guarded draft→confirmed sets confirmedAt, double-confirm idempotent, notifies creator); `cancel` (either member, → cancelled); `GET /:id` authz (member ✓ / non-member 403). Notification calls asserted best-effort (a throwing notify doesn't fail the action).
- **client-core (vitest):** each of the 6 wrappers hits the right path/method/body.
- **Mobile:** `tsc` clean; the `routeForNotification` `reservation` branch unit case (matchId → date-plan route; no matchId → home).
- **Live E2E (QA):** create → select → confirm (as the two distinct users) → cancel; verify authz (a third user is 403); verify the confirm notification lands + deep-links.

## Task decomposition (for writing-plans)

1. Schema: `DatePlan.creatorProfileId` + `confirmedAt` + migration.
2. shared: `DatePlan`/`DatePlanStatus` additions + `DatePlanView` type.
3. Backend: `memberContext` guard + harden `create` (matchId guard, membership, creatorProfileId, block) + `GET /:id` authz + `GET ?matchId=`.
4. Backend: `select` + `confirm` (status-guarded) + `cancel` + notifications (reservation type).
5. client-core: `date-plans.ts` wrappers + barrel + vitest.
6. Mobile: `date-plan/[matchId]` screen (state machine: create/select/confirm/cancel) + chat-room header entry.
7. Mobile: update `routeForNotification` `reservation` → date-plan deep-link + unit case.

## Global constraints (carry into every task)

- Membership + block authz on every date-plan route; role separation (select=creator, confirm=peer).
- Notifications best-effort non-fatal (never fail the write); reuse `reservation` type; `data: { datePlanId, matchId }`.
- Keep the hardcoded course generator + the unused payment columns untouched. Do NOT touch the legacy web DatePlan UI.
- Mobile: typed-route object form; plain RN + pure B&W (no Material); reuse the auth-store `myProfileId`.
- Migration is user-run (AI `prisma migrate` is classifier-blocked). `pnpm --filter @mingle/shared build` before backend/client-core (dual-package). ANSI-safe TS checks.
- Prettier: double quotes, `trailingComma: all`, `printWidth: 100`, semicolons.
