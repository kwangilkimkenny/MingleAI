# Phase 5c: Mobile Moderation UI — Design

**Date:** 2026-07-08
**Status:** Approved design (pre-plan)
**Branch:** `megahuni`

## Goal

Give mobile users app-store-compliant, always-available moderation tools: **report** a user (reason + optional details), **block/unblock**, and **manage the block list** — surfaced on every screen where they see another user (chat, party, proposals) — plus a new pure-black-&-white **설정/내정보** screen that hosts block management and logout.

## Why now

`docs/DEVELOPMENT_PLAN.md §3.10` mandates **신고/차단 상시 노출** ("report/block always visible") as an app-store dating-policy requirement. The backend safety module already ships every endpoint (Phase 4); mobile exposes none of it beyond a single chat-header block button. Phase 5c closes that gap on the client.

## Background — existing state (verified)

**Backend `safety` module (COMPLETE, Phase 4 — do NOT modify):**
- `POST /safety/report` (JwtAuthGuard) — `ReportUserDto { reportedProfileId: string; reason ∈ {harassment,fraud,fake_profile,inappropriate_content,spam,other}; details?: string (≤1000); evidencePartyId?: string }`. Self-report → 400, target-missing → 404, riskScore incremented once per `(reporter, reported)` pair (dedup), auto-suspend at riskScore ≥ 1.0. Returns the created `SafetyReport` row.
- `POST /safety/blocks` — `CreateBlockDto { blockedProfileId }`, upsert (idempotent).
- `GET /safety/blocks` → `PeerProfile[]`.
- `DELETE /safety/blocks/:blockedProfileId` → 204.
- `isBlockedBetween` (bidirectional) already filters matchmaking / messaging / proposals.

**client-core (`packages/client-core`):**
- `api/blocks.ts` exposes `createBlock(blockedProfileId): Promise<void>`, `getBlocks(): Promise<PeerProfile[]>`, `removeBlock(blockedProfileId): Promise<void>` (all barrel-exported).
- **No report wrapper exists.**

**Mobile (`apps/mobile`, Expo Router, Stack navigation):**
- Existing routes: `login`, `register`, `onboarding`, `(app)/{home,matching,party/[id],proposals,chats,chat/[roomId],notifications,date-plan/[matchId]}`.
- Only moderation UI = the chat header **"차단"** button (`chat/[roomId].tsx` `onBlockPress` → confirm `Alert` → `createBlock(match.peer.profileId)` → `router.replace("/(app)/chats")`).
- **No report UI, no block-list screen, no settings/profile screen.** `home.tsx` is a scrappy placeholder using RN `<Button>` (non-B&W) that currently holds `로그아웃` (`useAuthStore(s => s.logout)`).

**Shared types:**
- `PeerProfile = { profileId: string; name: string; age: number; gender: string; occupation: string; photoUrl?: string; preferenceSummary?: string }` (`packages/shared/src/types/social.ts`).
- `proposals.tsx` renders `item.peer` (PeerProfile-shaped) per `ProposalView`.
- `party/[id].tsx` renders `party.participants.map(p => …)` where `p` is `{ profileId, name, age, … }`, guarded by `p.profileId !== myProfileId`.
- `getMyProfile(): Promise<Profile | null>`.

## Scope

**In:** client-core `reportUser` wrapper; a reusable `PeerModerationMenu` component; three new screens (`report/[profileId]`, `blocks`, `settings`); wiring the ⋯ affordance into chat / party / proposals; a settings entry point from home.

**Out (do not touch):** backend safety (complete), web Admin report handling, party 2D Skia internals, message-level reporting / safety-center / report-history (was option C, deferred), age gate, content-filter UI, home.tsx B&W redesign (only add a 설정 entry).

## Global Constraints

- **Pure black & white — zero chroma.** Palette: ink `#17150F`, paper `#FFFFFF`, grays `#45413A` / `#8A857C` / `#D9D5CC`, fills `#F1EFE9` / `#E7E4DC` (+ transparent). No hue, no Material component rendering OS-colored chrome without an explicit B&W color. `ActivityIndicator color={INK}`. (OS `Alert` dialogs are exempt — they render native chrome, matching the existing 차단 Alert.)
- **No new runtime dependencies.** The ⋯ menu uses `Alert.alert`, not an action-sheet library.
- ESM `.js` barrel convention; TS strict; Prettier (double quotes, `trailingComma: all`, `printWidth: 100`, semicolons).
- Dynamic routes use the typed **object** form `router.push({ pathname, params })`. New routes not yet in Expo Router's gitignored typegen use a narrow `as any` cast on the pathname (self-heals on `expo start`), mirroring `date-plan/[matchId]`.
- Never stage `.env`. Do NOT push without explicit user confirmation.

## Design

### 1. client-core — `api/reports.ts` (new) + barrel + vitest

```ts
import { apiFetch } from "./client.js";

export const REPORT_REASONS = [
  "harassment",
  "fraud",
  "fake_profile",
  "inappropriate_content",
  "spam",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportInput {
  reportedProfileId: string;
  reason: ReportReason;
  details?: string;
  evidencePartyId?: string;
}

export function reportUser(input: ReportInput): Promise<void> {
  return apiFetch("/safety/report", { method: "POST", body: JSON.stringify(input) });
}
```

- Barrel (`packages/client-core/src/index.ts`): `export { reportUser, REPORT_REASONS } from "./api/reports.js";` and `export type { ReportReason, ReportInput } from "./api/reports.js";`.
- The wrapper types the response as `void` and ignores the returned `SafetyReport` row (mobile needs only success/failure).
- **vitest** (`reports-api.test.ts`, mirroring `date-plans-api.test.ts`): assert `reportUser` calls `apiFetch("/safety/report", { method: "POST", body: JSON.stringify(input) })` with and without the optional fields.

### 2. mobile — `src/lib/moderation.ts` (pure helper + vitest)

Keeps display/label logic out of the JSX so it is unit-testable.

```ts
import type { ReportReason } from "@mingle/client-core"; // (derive if shared isn't a direct dep — see note)

export const REASON_LABELS: Record<ReportReason, string> = {
  harassment: "괴롭힘 / 폭언",
  fraud: "사기 / 금전 요구",
  fake_profile: "가짜 프로필 / 사칭",
  inappropriate_content: "부적절한 콘텐츠",
  spam: "스팸 / 광고",
  other: "기타",
};
```

- If `@mingle/client-core`'s `ReportReason` cannot be imported directly (dep arrangement), derive the reason union locally from the same 6 string literals (single source: the labels map keys) — the plan resolves the exact import path, mirroring how `date-plan/[matchId].tsx` derived types.
- **vitest**: `REASON_LABELS` has a non-empty label for every one of the 6 `REPORT_REASONS`.

### 3. mobile — `src/components/PeerModerationMenu.tsx` (new, reusable)

The single source of the ⋯ affordance; dropped into all three peer surfaces (DRY).

- Props: `{ peer: { profileId: string; name: string }; evidencePartyId?: string; onBlocked?: () => void }`.
- Renders a B&W **⋯** `Pressable` (ink glyph, fill on press).
- On press → `Alert.alert(peer.name, undefined, [ 신고하기, 차단하기, {취소, style:"cancel"} ])`.
  - **신고하기** → `router.push({ pathname: "/(app)/report/[profileId]" as any, params: { profileId: peer.profileId, ...(evidencePartyId ? { evidencePartyId } : {}) } })`.
  - **차단하기** (`style:"destructive"`) → confirm `Alert` → `createBlock(peer.profileId)` → on success `onBlocked?.()`; on error `Alert(ApiError.message)`.

### 4. mobile — `app/(app)/report/[profileId].tsx` (new screen)

- `useLocalSearchParams<{ profileId: string; evidencePartyId?: string }>()`.
- State: `selectedReason: ReportReason | null`, `details: string`, `submitting: boolean`.
- UI (B&W): title **"신고하기"**, 6 reason rows rendered from `REPORT_REASONS` + `REASON_LABELS` as radio rows (filled vs outlined circle — no color), a multiline `details` `TextInput` (`maxLength={1000}` + a live `n/1000` counter), a submit button disabled until a reason is selected.
- Submit → `reportUser({ reportedProfileId: profileId, reason: selectedReason, details: details.trim() || undefined, evidencePartyId })`.
  - Success → `Alert` **"신고가 접수되었습니다"** with two actions: **"이 사용자도 차단"** (→ `createBlock(profileId)` then `router.back()`) and **"확인"** (→ `router.back()`).
  - Error → `Alert(ApiError.message ?? generic)`.

### 5. mobile — `app/(app)/blocks.tsx` (new screen)

- `useFocusEffect` → `getBlocks(): PeerProfile[]`. Handles loading (`ActivityIndicator color={INK}`), error (retry), and empty ("차단한 사용자가 없어요") states.
- Each row (B&W): `name · age`, `occupation`, and a **"차단 해제"** `Pressable` → confirm `Alert` → `removeBlock(profileId)` → remove the row locally (or refetch). Error → `Alert`.

### 6. mobile — `app/(app)/settings.tsx` (new screen)

- On focus, `getMyProfile()` → summary rows (name · age, occupation) with a loading/error fallback.
- List rows (B&W):
  - **차단 목록 관리** → `router.push("/(app)/blocks")`.
  - **로그아웃** → `useAuthStore.getState().logout()` (relocated from `home.tsx`; the raw `<Button>` on home is removed and replaced by a 설정 entry).

### 7. Entry-point wiring (상시 노출)

- **`chat/[roomId].tsx`**: replace the existing header **차단** `Pressable` with `<PeerModerationMenu peer={{ profileId: match.peer.profileId, name: match.peer.name }} onBlocked={() => router.replace("/(app)/chats")} />`. Keep the existing 데이트 플랜 button.
- **`party/[id].tsx`**: inside each participant card where `p.profileId !== myProfileId`, add `<PeerModerationMenu peer={{ profileId: p.profileId, name: p.name }} evidencePartyId={partyId} onBlocked={reload} />` (partyId = the `[id]` route param; `onBlocked` hides/refetches so the blocked participant disappears).
- **`proposals.tsx`**: on each proposal card, add `<PeerModerationMenu peer={{ profileId: item.peer.profileId, name: item.peer.name }} onBlocked={() => remove that proposal from the list} />`.
- **`home.tsx`**: add a **설정** entry (Pressable/Button) → `router.push("/(app)/settings")`; move logout into settings.

## Data flow

- **Report:** peer surface ⋯ → 신고하기 → `report/[profileId]` → `reportUser` → success (optional immediate block) → back.
- **Block:** peer surface ⋯ → 차단하기 → confirm → `createBlock` → `onBlocked` (surface hides/refetches the peer). Backend `isBlockedBetween` handles all future filtering.
- **Unblock:** settings → 차단 목록 관리 → `blocks` → 차단 해제 → `removeBlock` → list updates.

## Error handling

Every API call is wrapped; failures surface an `Alert` with `ApiError.message` (generic fallback otherwise). `blocks` and `settings` render explicit loading / error(+retry) / empty states rather than a blank screen.

## Testing

- **client-core:** `reports-api.test.ts` asserts path + method + body for `reportUser` (with and without optional fields); the full client-core suite stays green.
- **mobile:** `moderation.ts` helper vitest (every reason has a label). Screens and `PeerModerationMenu` are verified via `tsc --noEmit` CLEAN (the established mobile-screen convention — the app has no RN render-test harness), plus the existing mobile vitest suite (`route-for-notification`, etc.) staying green.
- **Build gate:** `tsc` CLEAN across `shared → client-core → mobile`.

## Resolved decisions

- ⋯ affordance via `Alert` (no new dependency). Report is a dedicated route screen. Surfaces = chat + party + proposals. Settings hosts block management + logout + profile summary. `reportUser` wrapper returns `void`.

## Out of scope / backlog

- Backend `POST /safety/report` returns the full `SafetyReport` row; the wrapper ignores it (could be projected server-side — backlog, not blocking).
- Message-level reporting, a safety-center / community-guidelines page, and report history/status (option C — future phase).
- `home.tsx` full B&W redesign (this phase only adds a 설정 entry and removes the raw logout button).
- A dedicated peer-profile detail screen (not added; the ⋯ menu lives on the existing peer surfaces).
