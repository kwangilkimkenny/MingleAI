# Phase 5a — Expo Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver best-effort Expo push notifications to the native app for events that already write in-app `Notification` rows, with multi-device token storage, a global on/off toggle, tap-to-deep-link, and a mobile notification-center screen.

**Architecture:** A new backend `PushModule` (`PushService` wrapping `expo-server-sdk`) + a `DeviceToken` model. `NotificationService.create` keeps writing the in-app row (source of truth) and then calls `PushService.sendToUser` **best-effort** (try/catch, never rethrows) — the same non-fatal pattern Phase 4 used for post-commit notifications. Mobile registers its Expo token, handles foreground notifications, and deep-links on tap via a pure `routeForNotification` map; a notification-center screen lists in-app notifications.

**Tech Stack:** NestJS 10 + Prisma/PostgreSQL, `expo-server-sdk` (backend), Vitest client-core, React Native + Expo Router + `expo-notifications` (mobile), jest (backend).

## Global Constraints

- Push is **best-effort + non-fatal** everywhere — a push failure must NEVER fail the originating write (`NotificationService.create` and `PushService.sendToUser` both wrap errors and log).
- The in-app `Notification` row remains the **source of truth**; push is additive. Push reuses the notification's own `title`/`message` (no separate copy map).
- Register/unregister/toggle routes are **caller-bound** (profile/user from JWT `sub`); `DeviceToken.token` is `@unique` and registration is an `upsert` on `token`; delete/unregister is scoped by `userId`.
- `expo-notifications`/`expo-device` live **ONLY in `apps/mobile`**; `@mingle/client-core` stays platform-agnostic (no expo import).
- Mobile: dynamic routes use the **typed object form** `router.push({ pathname, params })`; plain RN + StyleSheet, **pure black & white, zero chroma, no Material** (CLAUDE.md design system); when adding a dep run `pnpm install` and **stage `pnpm-lock.yaml`**.
- Migration is **user-run** (`pnpm prisma:migrate` from `apps/backend`; AI-run `prisma migrate` is blocked by the permission classifier). `pnpm prisma:generate` (client gen) is allowed for the AI.
- `@mingle/shared` must be built before the backend (dual-package). Build order: shared → client-core → apps.
- ANSI-safe TS error check: `... 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error"` (bare `grep "error TS"` false-negatives on color codes).
- Prettier: double quotes, `trailingComma: all`, `printWidth: 100`, semicolons. TS `strict`, packages ESM.

---

## File Structure

- `apps/backend/prisma/schema.prisma` — add `DeviceToken` model + `User.pushEnabled` + `User.deviceTokens` relation (Task 1).
- `apps/backend/src/push/push.service.ts` — Expo send + prune (Task 2).
- `apps/backend/src/push/push.module.ts` — module exporting `PushService` (Task 2).
- `apps/backend/src/push/device.controller.ts` — register/unregister/toggle routes (Task 3).
- `apps/backend/src/push/dto/register-device.dto.ts` — register body DTO (Task 3).
- `apps/backend/src/push/dto/set-push-enabled.dto.ts` — toggle body DTO (Task 3).
- `apps/backend/src/notification/notification.service.ts` + `notification.module.ts` — best-effort push wiring (Task 4).
- `packages/client-core/src/api/devices.ts` + `api/notifications.ts` + `index.ts` — API wrappers (Task 5).
- `apps/mobile/src/lib/push.ts` — permission/token/register/unregister + `routeForNotification` (Task 6).
- `apps/mobile/app/(app)/notifications.tsx` — notification-center screen (Task 7).

---

### Task 1: `DeviceToken` model + `User.pushEnabled` + migration

**Files:**
- Modify: `apps/backend/prisma/schema.prisma` (User model + new DeviceToken model)

**Interfaces:**
- Produces: Prisma models `DeviceToken { id, userId, token @unique, platform, createdAt, updatedAt }` and `User.pushEnabled: boolean`, `User.deviceTokens: DeviceToken[]`. Later tasks use `prisma.deviceToken` and `prisma.user.pushEnabled`.

- [ ] **Step 1: Add the DeviceToken model** at the end of `schema.prisma`:

```prisma
model DeviceToken {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  token     String   @unique
  platform  String // "ios" | "android"
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("device_tokens")
}
```

- [ ] **Step 2: Extend the `User` model** — add the field and relation (inside `model User { ... }`):

```prisma
  pushEnabled  Boolean  @default(true) @map("push_enabled")
```
and in its relations block, add:
```prisma
  deviceTokens DeviceToken[]
```

- [ ] **Step 3: Ask the user to run the migration** (AI cannot). Post this exact instruction and WAIT:

> Run from `apps/backend`: `pnpm prisma:migrate` (name it `phase5a_device_tokens`). This adds the `device_tokens` table + `users.push_enabled`.

- [ ] **Step 4: Generate the Prisma client** (AI-allowed): from `apps/backend`, `pnpm prisma:generate`. Expected: "Generated Prisma Client". Confirm the accessor exists:

Run: `find . -path '*/.prisma/client/index.d.ts' | head -1 | xargs grep -c "DeviceToken" ` → expect `> 0`.

- [ ] **Step 5: Verify backend still builds** (ANSI-safe):

Run: `pnpm --filter @mingle/shared build >/dev/null 2>&1 && pnpm --filter @mingle/backend build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN`
Expected: `CLEAN`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations
git commit -m "feat(push): DeviceToken model + User.pushEnabled (Phase 5a)"
```

> If Step 3 has not been run by the user yet, commit the schema change alone and note the migration is pending; downstream tasks that need the table at runtime (boot/E2E) require it, but unit tests (mocked Prisma) and `build` do not.

---

### Task 2: `PushService` + `PushModule` (Expo send + prune)

**Files:**
- Create: `apps/backend/src/push/push.service.ts`
- Create: `apps/backend/src/push/push.module.ts`
- Create: `apps/backend/src/push/push.service.spec.ts`
- Modify: `apps/backend/package.json` (add `expo-server-sdk`)

**Interfaces:**
- Consumes: `PrismaService` (`../prisma/prisma.service`), `ConfigService` (`@nestjs/config`, global — no import needed), `prisma.deviceToken`, `prisma.user`.
- Produces: `PushService.sendToUser(userId: string, payload: { type: string; title: string; body: string; data?: Record<string, unknown> }): Promise<void>` (never throws); `PushModule` exports `PushService`.

- [ ] **Step 1: Add the dependency**

Run: `cd apps/backend && pnpm add expo-server-sdk` then from repo root `pnpm install`. Stage `pnpm-lock.yaml` in the commit.

- [ ] **Step 2: Write the failing test** — `apps/backend/src/push/push.service.spec.ts`:

```ts
import { PushService } from "./push.service";

function makeService(overrides: { user?: any; tokens?: any[] } = {}) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(overrides.user ?? { id: "u1", pushEnabled: true }) },
    deviceToken: {
      findMany: jest.fn().mockResolvedValue(overrides.tokens ?? [{ token: "ExponentPushToken[a]" }]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as any;
  const config = { get: jest.fn().mockReturnValue(undefined) } as any;
  const svc = new PushService(prisma, config);
  return { svc, prisma };
}

it("does not send when pushEnabled is false", async () => {
  const { svc, prisma } = makeService({ user: { id: "u1", pushEnabled: false } });
  const send = jest.spyOn(svc as any, "dispatch").mockResolvedValue([]);
  await svc.sendToUser("u1", { type: "system", title: "t", body: "b" });
  expect(send).not.toHaveBeenCalled();
  expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
});

it("no-ops with zero tokens", async () => {
  const { svc } = makeService({ tokens: [] });
  const send = jest.spyOn(svc as any, "dispatch").mockResolvedValue([]);
  await svc.sendToUser("u1", { type: "system", title: "t", body: "b" });
  expect(send).not.toHaveBeenCalled();
});

it("builds an Expo message with title/body/data and sends it", async () => {
  const { svc } = makeService();
  const dispatch = jest.spyOn(svc as any, "dispatch").mockResolvedValue([{ status: "ok" }]);
  await svc.sendToUser("u1", { type: "message_received", title: "새 메시지", body: "hi", data: { roomId: "r1" } });
  expect(dispatch).toHaveBeenCalledWith([
    expect.objectContaining({
      to: "ExponentPushToken[a]",
      title: "새 메시지",
      body: "hi",
      data: { type: "message_received", roomId: "r1" },
    }),
  ]);
});

it("prunes a token whose ticket reports DeviceNotRegistered", async () => {
  const { svc, prisma } = makeService();
  jest.spyOn(svc as any, "dispatch").mockResolvedValue([
    { status: "error", details: { error: "DeviceNotRegistered" }, message: "x" },
  ]);
  await svc.sendToUser("u1", { type: "system", title: "t", body: "b" });
  expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({ where: { token: "ExponentPushToken[a]" } });
});

it("never throws when dispatch fails", async () => {
  const { svc } = makeService();
  jest.spyOn(svc as any, "dispatch").mockRejectedValue(new Error("network"));
  await expect(svc.sendToUser("u1", { type: "system", title: "t", body: "b" })).resolves.toBeUndefined();
});
```

- [ ] **Step 3: Run the test to see it fail**

Run: `pnpm --filter @mingle/backend exec jest push.service 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|Cannot find"`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `push.service.ts`**

```ts
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { PrismaService } from "../prisma/prisma.service";

export interface PushPayload {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);
  private readonly expo: Expo;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.expo = new Expo({ accessToken: config.get<string>("EXPO_ACCESS_TOKEN") });
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { pushEnabled: true } });
      if (!user || !user.pushEnabled) return;

      const rows = await this.prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
      const tokens = rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t));
      if (tokens.length === 0) return;

      const messages: ExpoPushMessage[] = tokens.map((to) => ({
        to,
        sound: "default",
        title: payload.title,
        body: payload.body,
        data: { type: payload.type, ...(payload.data ?? {}) },
      }));

      const tickets = await this.dispatch(messages);
      await this.prune(tokens, tickets);
    } catch (err) {
      this.log.warn(`push send failed for user ${userId}: ${err}`);
    }
  }

  /** Chunked send — split out so tests can stub the network. */
  private async dispatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];
    for (const chunk of chunks) {
      tickets.push(...(await this.expo.sendPushNotificationsAsync(chunk)));
    }
    return tickets;
  }

  /** Tickets are positional to `messages`, which are positional to `tokens`. */
  private async prune(tokens: string[], tickets: ExpoPushTicket[]): Promise<void> {
    await Promise.all(
      tickets.map((ticket, i) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          return this.prisma.deviceToken.deleteMany({ where: { token: tokens[i] } });
        }
        return undefined;
      }),
    );
  }
}
```

- [ ] **Step 5: Create `push.module.ts`**

```ts
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PushService } from "./push.service";

@Module({
  imports: [PrismaModule],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
```

- [ ] **Step 6: Run the tests + build**

Run: `pnpm --filter @mingle/backend exec jest push.service 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|FAIL"` → all pass.
Run: the ANSI-safe backend build → `CLEAN`.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/push/push.service.ts apps/backend/src/push/push.module.ts apps/backend/src/push/push.service.spec.ts apps/backend/package.json pnpm-lock.yaml
git commit -m "feat(push): PushService — Expo send (best-effort) + DeviceNotRegistered prune"
```

---

### Task 3: `DeviceController` — register / unregister / toggle

**Files:**
- Create: `apps/backend/src/push/device.controller.ts`
- Create: `apps/backend/src/push/dto/register-device.dto.ts`
- Create: `apps/backend/src/push/dto/set-push-enabled.dto.ts`
- Create: `apps/backend/src/push/device.controller.spec.ts`
- Modify: `apps/backend/src/push/push.module.ts` (register the controller)

**Interfaces:**
- Consumes: `JwtAuthGuard` (`../common/guards/jwt-auth.guard`), `CurrentUser`+`JwtPayload` (`../common/decorators/current-user.decorator`), `PrismaService`.
- Produces: `POST /devices`, `DELETE /devices/:token`, `PATCH /users/me/push`.

- [ ] **Step 1: Create the DTOs.** `register-device.dto.ts`:

```ts
import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class RegisterDeviceDto {
  @IsString() @IsNotEmpty() token!: string;
  @IsIn(["ios", "android"]) platform!: "ios" | "android";
}
```
`set-push-enabled.dto.ts`:
```ts
import { IsBoolean } from "class-validator";

export class SetPushEnabledDto {
  @IsBoolean() pushEnabled!: boolean;
}
```

- [ ] **Step 2: Write the failing test** — `device.controller.spec.ts`:

```ts
import { DeviceController } from "./device.controller";

function makeController() {
  const prisma = {
    deviceToken: {
      upsert: jest.fn().mockResolvedValue({ id: "d1" }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { update: jest.fn().mockResolvedValue({ id: "u1", pushEnabled: false }) },
  } as any;
  return { ctrl: new DeviceController(prisma), prisma };
}
const user = { userId: "u1" } as any;

it("register upserts on token (idempotent, reassigns userId)", async () => {
  const { ctrl, prisma } = makeController();
  await ctrl.register(user, { token: "ExponentPushToken[a]", platform: "ios" });
  expect(prisma.deviceToken.upsert).toHaveBeenCalledWith({
    where: { token: "ExponentPushToken[a]" },
    create: { userId: "u1", token: "ExponentPushToken[a]", platform: "ios" },
    update: { userId: "u1", platform: "ios" },
  });
});

it("unregister is scoped to the caller's userId", async () => {
  const { ctrl, prisma } = makeController();
  await ctrl.unregister(user, "ExponentPushToken[a]");
  expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
    where: { token: "ExponentPushToken[a]", userId: "u1" },
  });
});

it("toggle updates the caller's pushEnabled", async () => {
  const { ctrl, prisma } = makeController();
  await ctrl.setPush(user, { pushEnabled: false });
  expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { pushEnabled: false } });
});
```

- [ ] **Step 3: Run to see it fail** — `pnpm --filter @mingle/backend exec jest device.controller` → FAIL.

- [ ] **Step 4: Implement `device.controller.ts`**

```ts
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtPayload } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDeviceDto } from "./dto/register-device.dto";
import { SetPushEnabledDto } from "./dto/set-push-enabled.dto";

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DeviceController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("devices")
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceDto) {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { userId: user.userId, token: dto.token, platform: dto.platform },
      update: { userId: user.userId, platform: dto.platform },
    });
  }

  @Delete("devices/:token")
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(@CurrentUser() user: JwtPayload, @Param("token") token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { token, userId: user.userId } });
  }

  @Patch("users/me/push")
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPush(@CurrentUser() user: JwtPayload, @Body() dto: SetPushEnabledDto) {
    await this.prisma.user.update({ where: { id: user.userId }, data: { pushEnabled: dto.pushEnabled } });
  }
}
```

> Note the `@Controller()` (no prefix): routes are `/devices`, `/users/me/push`. `JwtPayload.userId` is the JWT `sub` (confirm against `current-user.decorator.ts` — Phase 4 used `user.userId`).

- [ ] **Step 5: Register the controller** in `push.module.ts` — add `controllers: [DeviceController]` and import it.

- [ ] **Step 6: Run tests + build + boot.** Tests pass; ANSI-safe build `CLEAN`; boot maps the routes:

Run boot: `pkill -f "node dist/main.js"; docker compose up -d && (cd apps/backend && node -e "require('child_process').execSync('node dist/main.js',{timeout:8000,stdio:'inherit'})") 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -iE "devices|users/me/push|successfully started" | head` then `pkill -f "node dist/main.js"`.
Expected: `Mapped {/devices, POST}`, `{/devices/:token, DELETE}`, `{/users/me/push, PATCH}`, started. (Requires the migration from Task 1 applied.)

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/push
git commit -m "feat(push): device register/unregister + pushEnabled toggle (caller-bound)"
```

---

### Task 4: Wire `NotificationService.create` → best-effort push

**Files:**
- Modify: `apps/backend/src/notification/notification.service.ts` (inject `PushService`, call after create)
- Modify: `apps/backend/src/notification/notification.module.ts` (import `PushModule`)
- Modify: `apps/backend/src/notification/notification.service.spec.ts` (or create if absent)

**Interfaces:**
- Consumes: `PushService.sendToUser` (Task 2).
- Produces: `NotificationService.create` now emits a best-effort push; behavior otherwise unchanged (still returns the created row).

- [ ] **Step 1: Write the failing test** — add to `notification.service.spec.ts` (create the file if none exists, wiring a mock prisma + push):

```ts
import { NotificationService } from "./notification.service";

function make() {
  const prisma = { notification: { create: jest.fn().mockResolvedValue({ id: "n1" }) } } as any;
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) } as any;
  return { svc: new NotificationService(prisma, push), prisma, push };
}

it("writes the in-app row AND sends a best-effort push", async () => {
  const { svc, prisma, push } = make();
  const row = await svc.create({ userId: "u1", type: "message_received", title: "새 메시지", message: "hi", data: { roomId: "r1" } });
  expect(row).toEqual({ id: "n1" });
  expect(prisma.notification.create).toHaveBeenCalled();
  expect(push.sendToUser).toHaveBeenCalledWith("u1", {
    type: "message_received",
    title: "새 메시지",
    body: "hi",
    data: { roomId: "r1" },
  });
});

it("still returns the row when push throws (non-fatal)", async () => {
  const { svc, push } = make();
  push.sendToUser.mockRejectedValue(new Error("expo down"));
  await expect(svc.create({ userId: "u1", type: "system", title: "t", message: "m" })).resolves.toEqual({ id: "n1" });
});
```

- [ ] **Step 2: Run to see it fail** — `jest notification.service` → FAIL (constructor arity / push undefined).

- [ ] **Step 3: Modify `notification.service.ts`** — inject `PushService`, import `Logger`, and after the create call push best-effort. Change the constructor and `create`:

```ts
import { Injectable, Logger } from "@nestjs/common";
import { PushService } from "../push/push.service";
// ...
@Injectable()
export class NotificationService {
  private readonly log = new Logger(NotificationService.name);
  constructor(
    private prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async create(dto: CreateNotificationDto) {
    const row = await this.prisma.notification.create({
      data: { userId: dto.userId, type: dto.type, title: dto.title, message: dto.message, data: dto.data },
    });
    try {
      await this.push.sendToUser(dto.userId, {
        type: dto.type,
        title: dto.title,
        body: dto.message,
        data: dto.data as Record<string, unknown> | undefined,
      });
    } catch (err) {
      this.log.warn(`push notify failed for user ${dto.userId}: ${err}`);
    }
    return row;
  }
```

Keep the rest of the file (other methods, the `createMany`/`delete` etc.) unchanged.

- [ ] **Step 4: Import `PushModule`** in `notification.module.ts`:

```ts
import { PushModule } from "../push/push.module";
// ...
@Module({
  imports: [PushModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
```

- [ ] **Step 5: Deep-link data guard.** For tap-to-room to work, the `message_received` notification must carry `roomId` in `data`. Open `apps/backend/src/messenger/messenger.service.ts` and confirm the `notifications.create({ type: "message_received", ... })` call includes `data: { roomId }`. If it does NOT, add `data: { roomId }` to that call (a one-line addition; do not change anything else). Do the same sanity check for `proposal_received` (`data: { proposalId }`) in `proposal.service.ts` — add if absent. This keeps `routeForNotification` (Task 6) able to target the exact screen.

- [ ] **Step 6: Run FULL backend suite + build + boot.**

Run: `pnpm --filter @mingle/backend build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN` → CLEAN.
Run: `pnpm --filter @mingle/backend test 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|FAIL"` → all pass.
Boot: confirm `NotificationModule dependencies initialized` + `successfully started`, no `Nest can't resolve` (PushModule must resolve into NotificationModule — no circular dep, Push imports only Prisma/Config).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/notification apps/backend/src/messenger apps/backend/src/proposal
git commit -m "feat(push): NotificationService.create emits best-effort push + deep-link data"
```

---

### Task 5: client-core API wrappers (devices + notifications)

**Files:**
- Create: `packages/client-core/src/api/devices.ts`
- Create: `packages/client-core/src/api/notifications.ts`
- Modify: `packages/client-core/src/index.ts` (barrel)
- Create/Modify: `packages/client-core/src/__tests__/devices-api.test.ts`

**Interfaces:**
- Consumes: `apiFetch` (`./client.js`).
- Produces: `registerDevice(token, platform)`, `unregisterDevice(token)`, `setPushEnabled(enabled)`; `getNotifications(limit?, offset?)`, `getUnreadCount()`, `markNotificationRead(id)`, `markAllNotificationsRead()`.

- [ ] **Step 1: Write the failing test** — `devices-api.test.ts` (mirror the existing `social-api.test.ts` mock-of-`apiFetch` style):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../api/client.js";
import {
  registerDevice, unregisterDevice, setPushEnabled,
  getNotifications, markNotificationRead,
} from "../index.js";

const fetchMock = vi.spyOn(client, "apiFetch").mockResolvedValue(undefined as never);
beforeEach(() => fetchMock.mockClear());

describe("devices + notifications API", () => {
  it("registerDevice POSTs token+platform", async () => {
    await registerDevice("ExponentPushToken[a]", "ios");
    expect(fetchMock).toHaveBeenCalledWith("/devices", {
      method: "POST",
      body: JSON.stringify({ token: "ExponentPushToken[a]", platform: "ios" }),
    });
  });
  it("unregisterDevice DELETEs by token", async () => {
    await unregisterDevice("ExponentPushToken[a]");
    expect(fetchMock).toHaveBeenCalledWith("/devices/ExponentPushToken[a]", { method: "DELETE" });
  });
  it("setPushEnabled PATCHes the toggle", async () => {
    await setPushEnabled(false);
    expect(fetchMock).toHaveBeenCalledWith("/users/me/push", {
      method: "PATCH", body: JSON.stringify({ pushEnabled: false }),
    });
  });
  it("getNotifications GETs with paging query", async () => {
    await getNotifications(20, 0);
    expect(fetchMock).toHaveBeenCalledWith("/notifications?limit=20&offset=0");
  });
  it("markNotificationRead PATCHes the item", async () => {
    await markNotificationRead("n1");
    expect(fetchMock).toHaveBeenCalledWith("/notifications/n1/read", { method: "PATCH" });
  });
});
```

- [ ] **Step 2: Run to see it fail** — `pnpm --filter @mingle/client-core test 2>&1 | grep -E "FAIL|Cannot find"` → FAIL.

- [ ] **Step 3: Implement `api/devices.ts`**

```ts
import { apiFetch } from "./client.js";

export function registerDevice(token: string, platform: "ios" | "android"): Promise<void> {
  return apiFetch<void>("/devices", { method: "POST", body: JSON.stringify({ token, platform }) });
}

export function unregisterDevice(token: string): Promise<void> {
  return apiFetch<void>(`/devices/${token}`, { method: "DELETE" });
}

export function setPushEnabled(pushEnabled: boolean): Promise<void> {
  return apiFetch<void>("/users/me/push", { method: "PATCH", body: JSON.stringify({ pushEnabled }) });
}
```

- [ ] **Step 4: Implement `api/notifications.ts`**

```ts
import { apiFetch } from "./client.js";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: unknown;
  read: boolean;
  createdAt: string;
}

export function getNotifications(limit = 50, offset = 0): Promise<{ notifications: AppNotification[]; total: number; limit: number; offset: number }> {
  return apiFetch(`/notifications?limit=${limit}&offset=${offset}`);
}

export function getUnreadCount(): Promise<{ unreadCount: number }> {
  return apiFetch("/notifications/unread-count");
}

export function markNotificationRead(id: string): Promise<void> {
  return apiFetch<void>(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead(): Promise<void> {
  return apiFetch<void>("/notifications/read-all", { method: "POST" });
}
```

- [ ] **Step 5: Extend the barrel** `index.ts` (append, `.js` ESM convention):

```ts
export { registerDevice, unregisterDevice, setPushEnabled } from "./api/devices.js";
export {
  getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,
} from "./api/notifications.js";
export type { AppNotification } from "./api/notifications.js";
```

- [ ] **Step 6: Run vitest + build**

Run: `pnpm --filter @mingle/shared build >/dev/null 2>&1 && pnpm --filter @mingle/client-core build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN` → CLEAN.
Run: `pnpm --filter @mingle/client-core test 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Test Files|Tests |FAIL"` → all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/client-core
git commit -m "feat(client-core): device-registration + notifications API wrappers"
```

---

### Task 6: Mobile push lib — permission, token, register, deep-link

**Files:**
- Create: `apps/mobile/src/lib/push.ts`
- Create: `apps/mobile/src/lib/route-for-notification.ts` (pure map, unit-testable)
- Create: `apps/mobile/src/lib/__tests__/route-for-notification.test.ts`
- Modify: `apps/mobile/app/(app)/_layout.tsx` (mount push registration + listeners after auth)
- Modify: `apps/mobile/package.json` (add `expo-notifications`, `expo-device`)

**Interfaces:**
- Consumes: `registerDevice`/`unregisterDevice` (Task 5), Expo Router `router`.
- Produces: `routeForNotification(data)` returns an Expo Router href; `usePushRegistration()` (a hook) or `initPush()`/`teardownPush()` for the layout to call.

- [ ] **Step 1: Add deps** — `cd apps/mobile && pnpm add expo-notifications expo-device`, then repo-root `pnpm install`. **Stage `pnpm-lock.yaml`.** (These are Expo SDK 56-compatible; if `expo install` version-pinning is needed, run `pnpm --filter @mingle/mobile exec expo install expo-notifications expo-device`.)

- [ ] **Step 2: Write the failing test** — `route-for-notification.test.ts`:

```ts
import { routeForNotification } from "../route-for-notification";

it("routes message_received to the chat room with roomId", () => {
  expect(routeForNotification({ type: "message_received", roomId: "r1" })).toEqual({
    pathname: "/(app)/chat/[roomId]", params: { roomId: "r1" },
  });
});
it("routes proposal_received to proposals", () => {
  expect(routeForNotification({ type: "proposal_received" })).toBe("/(app)/proposals");
});
it("routes match_made to chats", () => {
  expect(routeForNotification({ type: "match_made" })).toBe("/(app)/chats");
});
it("falls back to the notification center for system/unknown", () => {
  expect(routeForNotification({ type: "system" })).toBe("/(app)/notifications");
  expect(routeForNotification({ type: "whatever" as any })).toBe("/(app)/notifications");
});
it("message_received without roomId falls back to chats", () => {
  expect(routeForNotification({ type: "message_received" })).toBe("/(app)/chats");
});
```

> Mobile has no test runner wired by default. If `apps/mobile` has no jest/vitest config, add a minimal `vitest` dev-dep + `vitest.config.ts` scoped to `src/lib/__tests__` in this task (mirror client-core's vitest setup), OR keep `route-for-notification.ts` pure and validate it via `tsc` + a temporary `node --loader` script, then delete the script. Prefer wiring vitest so the map stays regression-covered. Confirm the chosen approach runs green before Step 4.

- [ ] **Step 3: Implement `route-for-notification.ts`**

```ts
import type { Href } from "expo-router";

export interface NotificationData {
  type: string;
  roomId?: string;
  proposalId?: string;
  partyId?: string;
}

export function routeForNotification(data: NotificationData): Href {
  switch (data.type) {
    case "message_received":
      return data.roomId
        ? { pathname: "/(app)/chat/[roomId]", params: { roomId: data.roomId } }
        : "/(app)/chats";
    case "match_made":
      return "/(app)/chats";
    case "proposal_received":
      return "/(app)/proposals";
    case "party_reminder":
    case "match_result":
      return "/(app)/home";
    case "reservation":
      return "/(app)/home"; // retargeted in Phase 5b
    case "system":
    default:
      return "/(app)/notifications";
  }
}
```

- [ ] **Step 4: Implement `push.ts`**

```ts
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { router } from "expo-router";
import { registerDevice, unregisterDevice } from "@mingle/client-core";
import { routeForNotification, type NotificationData } from "./route-for-notification";

// Foreground: show the banner (MVP).
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

async function acquireAndRegisterToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators don't get Expo push tokens
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  await registerDevice(token, Platform.OS === "ios" ? "ios" : "android");
  return token;
}

/** Mount in the authenticated layout. Registers the token + wires the tap listener. */
export function usePushRegistration(enabled: boolean) {
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    acquireAndRegisterToken()
      .then((t) => { if (alive) tokenRef.current = t; })
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as NotificationData;
      router.push(routeForNotification(data));
    });

    return () => {
      alive = false;
      sub.remove();
      const t = tokenRef.current;
      if (t) unregisterDevice(t).catch(() => {}); // best-effort on unmount/logout
    };
  }, [enabled]);
}
```

> `expo-constants` is already an Expo dep. If `Constants.expoConfig.extra.eas.projectId` is unset in this repo's `app.json`, `getExpoPushTokenAsync()` without a projectId still works in classic Expo; note the projectId as a config prerequisite but do not block on it.

- [ ] **Step 5: Mount in `(app)/_layout.tsx`** — inside the authenticated `AppLayout`, after the `token`/profile gate resolves `ok`, call the hook. Add near the top of the component body:

```ts
import { usePushRegistration } from "../../src/lib/push";
// ...inside AppLayout(), after the existing hooks:
usePushRegistration(profileState === "ok");
```

(Only register once the user is authenticated + has a profile — the hook's `enabled` gate handles the timing; the listener is torn down on unmount.)

- [ ] **Step 6: Verify build + tsc + tests**

Run: `pnpm --filter @mingle/shared build >/dev/null 2>&1 && pnpm --filter @mingle/client-core build >/dev/null 2>&1 && cd apps/mobile && pnpm exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN` → CLEAN.
Run the `route-for-notification` test (per the runner wired in Step 2) → pass.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src apps/mobile/app apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): expo-notifications registration + tap deep-link routing"
```

---

### Task 7: Mobile notification-center screen + unread badge + push toggle

**Files:**
- Create: `apps/mobile/app/(app)/notifications.tsx`
- Modify: `apps/mobile/app/(app)/home.tsx` (add an entry point / unread badge to the center — a link)
- Optionally Modify: a settings area for the `pushEnabled` toggle (fold into `notifications.tsx` header for MVP)

**Interfaces:**
- Consumes: `getNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `getUnreadCount`, `setPushEnabled`, `AppNotification` (Task 5); `routeForNotification` (Task 6).

- [ ] **Step 1: Implement `notifications.tsx`** — list, mark-read on tap + deep-link, mark-all, and a global push toggle. Plain RN, pure B&W:

```tsx
import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, Switch, StyleSheet, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  getNotifications, markNotificationRead, markAllNotificationsRead, setPushEnabled,
  type AppNotification, ApiError,
} from "@mingle/client-core";
import { routeForNotification, type NotificationData } from "../../src/lib/route-for-notification";

const INK = "#17150F";

export default function Notifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [pushOn, setPushOn] = useState(true);

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    getNotifications(50, 0)
      .then((res) => { if (alive) { setItems(res.notifications); setPhase("ready"); } })
      .catch((e) => { if (alive) setPhase("error"); });
    return () => { alive = false; };
  }, []);

  useFocusEffect(load);

  async function onTapItem(n: AppNotification) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      markNotificationRead(n.id).catch(() => {});
    }
    router.push(routeForNotification((n.data ?? { type: n.type }) as NotificationData));
  }

  async function onMarkAll() {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    markAllNotificationsRead().catch(() => {});
  }

  async function onTogglePush(v: boolean) {
    setPushOn(v);
    setPushEnabled(v).catch(() => setPushOn(!v));
  }

  if (phase === "loading") return <View style={styles.center}><ActivityIndicator size="large" color={INK} /></View>;
  if (phase === "error") return <View style={styles.center}><Text style={styles.err}>알림을 불러오지 못했어요.</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>알림</Text>
        <View style={styles.toggle}><Text style={styles.toggleLabel}>푸시</Text><Switch value={pushOn} onValueChange={onTogglePush} /></View>
      </View>
      <Pressable onPress={onMarkAll}><Text style={styles.markAll}>모두 읽음</Text></Pressable>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={<Text style={styles.empty}>아직 알림이 없어요.</Text>}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, !item.read && styles.unread]} onPress={() => onTapItem(item)}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowMsg}>{item.message}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#FFFFFF" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "700", color: INK },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleLabel: { color: INK, fontSize: 14 },
  markAll: { color: "#8A857C", fontSize: 13, marginBottom: 8 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E7E4DC" },
  unread: { backgroundColor: "#F1EFE9" },
  rowTitle: { fontSize: 15, fontWeight: "600", color: INK },
  rowMsg: { fontSize: 13, color: "#45413A", marginTop: 2 },
  empty: { textAlign: "center", color: "#8A857C", marginTop: 40 },
  err: { color: INK },
});
```

- [ ] **Step 2: Add an entry point** on `home.tsx` — a link/button to `/(app)/notifications` (object form not needed; static route). Example: `<Button title="알림" onPress={() => router.push("/(app)/notifications")} />` consistent with the existing home buttons. (An unread badge count via `getUnreadCount` is optional polish — include a small count next to the button if trivial; otherwise the list itself suffices for MVP.)

- [ ] **Step 3: Verify tsc**

Run: `cd apps/mobile && pnpm exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN` → CLEAN. (The `/(app)/notifications` route now exists so `routeForNotification`'s `"/(app)/notifications"` href type-resolves.)

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(app)"
git commit -m "feat(mobile): notification center screen + push toggle"
```

---

## Self-Review (completed by author)

- **Spec coverage:** DeviceToken+pushEnabled (T1) · PushService send/prune/best-effort (T2) · register/unregister/toggle caller-bound (T3) · create→best-effort push + deep-link data (T4) · client-core wrappers incl. notifications (T5) · mobile permission/token/register/deep-link (T6) · notification-center + toggle (T7). Deployment FCM/APNs note is a §9 prerequisite (no task — not code). ✓
- **Placeholder scan:** none — every code step has complete code; the only conditional is T6-Step2's test-runner wiring (explicit alternatives given, not a placeholder).
- **Type consistency:** `sendToUser(userId, { type, title, body, data })` matches T2↔T4; `registerDevice(token, platform)` matches T5↔T6; `routeForNotification(NotificationData)→Href` matches T6↔T7; `AppNotification` shape (T5) matches the backend `notification` row + the screen (T7). `DeviceToken.token @unique` upsert matches T1↔T3. ✓
- **Known follow-ups (non-blocking, for the QA/backlog):** foreground suppression when already on the target screen; unread-badge on a tab bar; receipt-poll (vs ticket-level) prune; `EXPO_ACCESS_TOKEN`/`projectId` prod config.
