# Phase 5a — Expo Push Notifications (Design Spec)

**Status:** approved 2026-07-07 · branch `megahuni` (builds on Phases 0–4)
**Scope:** Expo push-notification infrastructure only. DatePlan/reservation and mobile moderation UI are **separate** Phase-5b/5c specs (Phase 5 was decomposed; push is the foundational infra the others reuse).

## Goal

Deliver push notifications to the native app for the events that already produce in-app `Notification` rows (proposals, matches, DMs, party/reservation/system). The in-app notification row stays the source of truth; push is a **best-effort, non-fatal** side-channel layered on top — mirroring the Phase-4 pattern where post-commit notifications never fail the originating request.

## Non-goals (this spec)

- Per-type notification preferences (a single global toggle only; per-type deferred).
- Real restaurant reservation / payment (Phase 5b).
- Mobile moderation UI (Phase 5c).
- Production FCM/APNs credential provisioning — a **deployment prerequisite** configured in EAS, not code (see §9).
- Rich media / notification categories / action buttons.

## Architecture

Three layers, one new backend module.

- **Backend** — a new `PushModule` (`PushService` wrapping `expo-server-sdk`) + a `DeviceToken` Prisma model + a `DeviceController` (register/unregister). `NotificationService.create` keeps writing the in-app row unchanged, then makes a **best-effort** call to `PushService.sendToUser(userId, notification)` (try/catch + `Logger.warn`, never rethrows). `PushService` loads the user's `DeviceToken`s (only if `User.pushEnabled`), builds Expo messages, sends them chunked via `expo-server-sdk`, and prunes tokens whose receipts report `DeviceNotRegistered`.
- **client-core** — `registerDevice(token, platform)` / `unregisterDevice(token)` API wrappers (platform-agnostic, using the existing `apiFetch`).
- **Mobile** — `expo-notifications`: request permission + fetch the Expo push token after login, register it; a foreground notification handler; a response listener that deep-links on tap; unregister on logout. Plus a **notifications-center screen** (lists the in-app `Notification`s via the existing `GET /notifications`, mark-read, unread badge) — the in-app counterpart and the tap fallback for `system`-type notifications.

## Data model (migration — the user runs `prisma migrate`; blocked by the AI-run classifier)

`apps/backend/prisma/schema.prisma`:

```prisma
model DeviceToken {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  token     String   @unique                 // Expo push token, e.g. ExponentPushToken[xxx]
  platform  String                            // "ios" | "android"
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("device_tokens")
}
```

- Add to `User`: `pushEnabled Boolean @default(true) @map("push_enabled")` and the relation `deviceTokens DeviceToken[]`.
- `token @unique` (not `@@unique([userId, token])`): a physical device has ONE Expo token; on re-register the same token may move to a different user (device handed over / account switch) — `upsert` on `token` reassigns `userId`. This makes registration idempotent and self-healing.

## Backend — `PushService` (`apps/backend/src/push/push.service.ts`)

- `constructor(prisma, config)` — instantiate `new Expo({ accessToken: config.get("EXPO_ACCESS_TOKEN") })` (access token optional; unset is valid for dev). Hold a `Logger`.
- `sendToUser(userId: string, notification: { type: string; title: string; body: string; data?: Record<string, unknown> }): Promise<void>` —
  1. Load `user.pushEnabled`; if false, return (no-op).
  2. Load the user's `DeviceToken`s. If none, return.
  3. Build `ExpoPushMessage[]`: `{ to: token, title, body, sound: "default", data: { type, ...data } }`, filtering with `Expo.isExpoPushToken(token)` (prune non-Expo tokens on the spot).
  4. `expo.chunkPushNotifications(messages)` → `expo.sendPushNotificationsAsync(chunk)` per chunk, collecting tickets.
  5. **Receipt/error handling:** for any ticket with `status: "error"` whose `details?.error === "DeviceNotRegistered"`, delete that `DeviceToken`. (A follow-up receipt poll is out of scope; the ticket-level `DeviceNotRegistered` is the common prune signal.)
  6. Never throw — wrap the whole thing so a push failure is logged, not propagated. (`NotificationService` also wraps the call, belt-and-suspenders.)
- `pruneToken(token: string)` — `deviceToken.deleteMany({ where: { token } })`.

### Title/body mapping

`PushService` (or a small pure `notificationCopy(type, data)` helper — unit-testable) maps a notification `type` → `{ title, body }` (Korean copy), e.g. `proposal_received → { title: "새 프로포즈", body: "..." }`, `match_made → "매칭 성사"`, `message_received → "새 메시지"`. The `data` payload carries `{ type, <targetId> }` for deep-linking (e.g. `roomId` for `message_received`, none for `system`).

### `NotificationService.create` change

After the existing `prisma.notification.create(...)` (unchanged, still returns the row), add:

```ts
try {
  await this.push.sendToUser(dto.userId, { type: dto.type, ...notificationCopy(dto.type, dto.data), data: dto.data });
} catch (err) {
  this.log.warn(`push send failed for user ${dto.userId}: ${err}`);
}
```

`PushModule` must export `PushService`; `NotificationModule` imports `PushModule`. Confirm no circular dependency (Push imports only Prisma/Config).

## Backend — `DeviceController` (`apps/backend/src/push/device.controller.ts`)

All routes under `JwtAuthGuard`, caller-bound (userId from JWT `sub`):

- `POST /devices` — body `{ token: string; platform: "ios" | "android" }` (class-validator: `@IsString`/`@IsNotEmpty`, platform `@IsIn(["ios","android"])`). `upsert` on `token` → `{ create: { userId, token, platform }, update: { userId, platform } }`. Returns 204/201.
- `DELETE /devices/:token` — `deleteMany({ where: { token, userId } })` (caller-bound so a user can only unregister their own token). 204.
- `PATCH /users/me/push` — canonical route for the toggle; body `{ pushEnabled: boolean }` (`@IsBoolean`) → `user.update({ where: { id: userId }, data: { pushEnabled } })`. Lives on the `DeviceController` (or a small `UserSettingsController`) so it stays JWT caller-bound. Powers the global toggle. (A future settings screen may batch more prefs here; out of scope now.)

## client-core (`packages/client-core/src/api/devices.ts` + barrel)

```ts
export function registerDevice(token: string, platform: "ios" | "android"): Promise<void>;   // POST /devices
export function unregisterDevice(token: string): Promise<void>;                                // DELETE /devices/:token
export function setPushEnabled(enabled: boolean): Promise<void>;                               // PATCH /users/me/push
```

Follow the existing `api/*.ts` `apiFetch` pattern; re-export from `index.ts` with the `.js` ESM convention. No new client-core dependency (`expo-notifications` lives ONLY in mobile).

## Mobile

- **`apps/mobile/package.json`** adds `expo-notifications` (+ `expo-device` if needed for the physical-device check). Run `pnpm install` and **stage `pnpm-lock.yaml`** (the Phase-1/Phase-4 dirty-lockfile lesson).
- **Registration** (`apps/mobile/src/lib/push.ts`): after login + a successful profile resolve, request permission (`Notifications.requestPermissionsAsync`), and if granted fetch the Expo token (`Notifications.getExpoPushTokenAsync({ projectId })`), then `registerDevice(token, Platform.OS)`. Store the token so logout can `unregisterDevice(token)`. Physical-device only (Expo push tokens aren't issued on simulators — guard with `Device.isDevice`, no-op on simulator).
- **Foreground handler:** `Notifications.setNotificationHandler` → show the alert (MVP) unless the user is already on the exact target screen. Keep the MVP simple: show it.
- **Tap → deep-link** (`Notifications.addNotificationResponseReceivedListener`): read `response.notification.request.content.data.type` + id and route via a pure `routeForNotification(data)` map (unit-testable):
  - `message_received → { pathname: "/(app)/chat/[roomId]", params: { roomId } }`
  - `proposal_received → "/(app)/proposals"`
  - `match_made → "/(app)/chats"`
  - `party_reminder | match_result → "/(app)/home"` (or the party screen if an id is present)
  - `reservation → "/(app)/home"` (retargeted in Phase 5b)
  - `system` (or unknown) → `"/(app)/notifications"` (the center)
  All dynamic routes use the typed object form (typed-routes lesson).
- **Notifications-center screen** (`apps/mobile/app/(app)/notifications.tsx`): lists `GET /notifications` (client-core `getNotifications` — add the wrapper if absent, mirroring the web usage), shows read/unread, marks read (`PATCH /notifications/:id/read`), and surfaces an unread badge. Tapping an item deep-links via the same `routeForNotification` map. This is the in-app home for notifications and the tap fallback.
- **Settings toggle:** a `pushEnabled` switch (on a settings/profile screen) calling `setPushEnabled`. Reflects/sets `User.pushEnabled`.
- **Design system:** plain RN + StyleSheet, pure black & white (no chroma, no Material) per CLAUDE.md — consistent with the Phase-4 screens.

## Delivery flow (end to end)

1. A domain event calls `NotificationService.create({ userId, type, title/message, data })` → writes the in-app row (source of truth, unchanged).
2. Best-effort: if `user.pushEnabled`, `PushService.sendToUser` loads the user's `DeviceToken`s, builds Expo messages with `data:{type,targetId}`, sends chunked, prunes `DeviceNotRegistered` tokens. Any failure is logged, not thrown.
3. Mobile: background → OS notification; foreground → handler. Tap → response listener → `routeForNotification(data)` → navigate.

## Error handling / security

- **Push is best-effort + non-fatal** — a push failure never 500s the originating request (both `NotificationService.create` and `PushService.sendToUser` wrap errors).
- **Invalid-token pruning** on `DeviceNotRegistered` keeps the token table clean and avoids repeat failures.
- **Caller-bound routes** — register/unregister/toggle all derive the user from the JWT; a user can only touch their own tokens (`DELETE` and `deleteMany` are scoped by `userId`). No token enumeration (unregister is by the caller's own token value).
- **Chunking** via `expo-server-sdk` respects Expo's batch limits.
- **No secret leakage** — `EXPO_ACCESS_TOKEN` (optional) is server-only; the Expo push token is not sensitive PII but is per-user and only ever handled caller-bound.

## Environment / config

- Backend `.env` (optional): `EXPO_ACCESS_TOKEN` (Expo push security, optional in dev → unset is fine; recommended in prod). Validated with a safe default (unset → `new Expo()` with no access token).
- Mobile: the Expo `projectId` (from `app.json`/EAS) is required by `getExpoPushTokenAsync`.

## Testing

- **Backend (jest, mock `expo-server-sdk`):** `PushService.sendToUser` — respects `pushEnabled=false` (no send), no-op with zero tokens, builds correct messages (`to/title/body/data.type`), prunes a token on a `DeviceNotRegistered` ticket, and NEVER throws on an SDK error. `DeviceController` — register upserts (idempotent, reassigns userId on device handover), unregister is caller-bound, toggle updates `pushEnabled`. `NotificationService.create` — still writes the row AND calls push best-effort; a throwing `PushService` does NOT reject `create`. `notificationCopy`/title-body mapping is a pure unit test.
- **client-core (vitest):** the three API wrappers hit the right method+path+body (mock `apiFetch`).
- **Mobile:** `tsc --noEmit` clean; `routeForNotification` is a pure unit-testable function tested for every notification type incl. unknown → center.
- **Live E2E (QA phase):** register a real/sandbox token, trigger each notification type, verify an Expo push ticket is accepted (or mock the SDK for a deterministic CI run); verify a `DeviceNotRegistered` prunes the row; verify `pushEnabled=false` suppresses the send while the in-app row still writes.

## Deployment prerequisite (not code)

Dev/Expo-Go push works via Expo's relay with a dev Expo push token. **Production requires FCM (Android) + APNs (iOS) credentials configured in EAS** and a standalone/dev build (Expo Go can't receive production push on iOS). This is a release checklist item, surfaced here so it isn't a surprise; the code + tests do not depend on it.

## Task decomposition (for writing-plans)

1. `DeviceToken` model + `User.pushEnabled` + migration.
2. `PushModule`/`PushService` (`expo-server-sdk`, sendToUser, prune) + `notificationCopy` + unit tests.
3. `DeviceController` (register/unregister/toggle) + DTOs + caller-bound tests.
4. Wire `NotificationService.create` → best-effort push (non-fatal) + module wiring, no-circular-dep.
5. client-core `devices.ts` wrappers + barrel + vitest.
6. Mobile push lib (permission/token/register/unregister + foreground handler + tap deep-link `routeForNotification`) + `expo-notifications` dep (stage lockfile).
7. Mobile notifications-center screen + `getNotifications`/mark-read wrappers + unread badge + settings toggle.

## Global constraints (carry into every task)

- Push best-effort + non-fatal everywhere (never fail the originating write).
- Register/unregister/toggle routes caller-bound (JWT userId); `token @unique` upsert; unregister/delete scoped by `userId`.
- In-app `Notification` row remains the source of truth; push is additive.
- `expo-notifications` lives ONLY in mobile; client-core stays platform-agnostic.
- Mobile: typed-route object form; plain RN + pure B&W (no Material); stage `pnpm-lock.yaml` when adding the dep.
- Migration is user-run (AI-run `prisma migrate` is blocked by the classifier).
- ANSI-safe TS checks (`grep "error TS"` false-negatives on color codes).
