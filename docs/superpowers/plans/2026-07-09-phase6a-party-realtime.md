# Phase 6a: Party Realtime Gateway + Presence + Party Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Socket.IO party gateway with JWT auth, live presence, persisted party-wide chat, and the `party:move` position-broadcast transport (for 6b), surfaced in the mobile party screen as a chat + presence section.

**Architecture:** Mirror the proven `MessengerGateway` stack end-to-end: NestJS `@WebSocketGateway` with JWT-handshake auth and `PartyParticipant` authorization on the backend; an injected-`ioFactory` socket wrapper in client-core; REST history as the source of truth with best-effort socket broadcast. Presence is an in-memory `partyId → Map<socketId, profileId>` roster. No schema change — `PartyMessage`/`PartyParticipant` exist since Phase 1.

**Tech Stack:** NestJS 10 + `@nestjs/websockets` + socket.io (already installed), Prisma (`PartyMessage`), Jest; `@mingle/shared` (dual-package); `@mingle/client-core` (TS ESM, Vitest); Expo RN (`socket.io-client` already installed).

## Global Constraints

- Realtime mirrors `MessengerGateway` (`apps/backend/src/messenger/messenger.gateway.ts`): default namespace, `cors: { origin: true }`, `handshake.auth.token` → `jwt.verify` → `client.data.userId`, room = partyId.
- Authorization: every socket action and the messages endpoint require the caller to be a `PartyParticipant` (else `error {message:"forbidden"}` / 403).
- REST history = source of truth; socket = live layer; broadcasts best-effort (never throw into a persistence path).
- Chat content bounds: trimmed, 1–2000 chars (matching the DM default).
- **Pure black & white** mobile UI: ink `#17150F`, paper `#FFFFFF`, grays `#45413A`/`#8A857C`/`#D9D5CC`, fills `#F1EFE9`/`#E7E4DC`. Zero chroma.
- ESM `.js` barrels; TS strict; Prettier (double quotes, `trailingComma: all`, `printWidth: 100`, semicolons). Never stage `.env`. Do NOT push.
- No new dependencies anywhere.
- The party REST controller is `@Controller("parties")` — the history endpoint is `GET /parties/:id/messages`.
- ANSI-safe error checks: pipe build/tsc output through `sed -E 's/\x1b\[[0-9;]*m//g'` before grepping `error TS`.
- Backend guard/decorator imports: `JwtAuthGuard` from `../common/guards/jwt-auth.guard`, `CurrentUser`/`JwtPayload` from `../common/decorators/current-user.decorator` (`JwtPayload.userId`).

---

### Task 1: shared party realtime types

**Files:**
- Modify: `packages/shared/src/types/party.ts` (append)
- Modify: `packages/shared/src/index.ts` (extend the `types/party.js` export line)

**Interfaces:**
- Produces: `PartyMessageView { id, partyId, profileId, content, createdAt: string }`, `PartyPresence { partyId, members: string[] }`, `PartyMove { profileId, x: number, y: number }` — consumed by Tasks 2–5.

- [ ] **Step 1: Append to `packages/shared/src/types/party.ts`**

```ts
/** A persisted party-wide chat message (REST history + socket broadcast payload). */
export interface PartyMessageView {
  id: string;
  partyId: string;
  profileId: string;
  content: string;
  createdAt: string;
}

/** Live roster of a party room — distinct profileIds currently connected. */
export interface PartyPresence {
  partyId: string;
  members: string[];
}

/** An ephemeral position update broadcast to other party members (2D space, Phase 6b). */
export interface PartyMove {
  profileId: string;
  x: number;
  y: number;
}
```

- [ ] **Step 2: Extend the barrel** — in `packages/shared/src/index.ts`, change the existing line
`export type { PartyStatus, Party } from "./types/party.js";` to:

```ts
export type { PartyStatus, Party, PartyMessageView, PartyPresence, PartyMove } from "./types/party.js";
```

- [ ] **Step 3: Build both packages to prove the types flow**

Run: `pnpm --filter @mingle/shared build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS" || echo CLEAN`
Expected: CLEAN (and `pnpm --filter @mingle/shared test` still green: `Test Files  N passed`).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/party.ts packages/shared/src/index.ts
git commit -m "feat(shared): party realtime types (PartyMessageView, PartyPresence, PartyMove)"
```

---

### Task 2: backend party.service — assertParticipant + messages (TDD)

**Files:**
- Modify: `apps/backend/src/party/party.service.ts`
- Test: `apps/backend/src/party/party.service.spec.ts` (create — none exists)

**Interfaces:**
- Consumes: `PartyMessageView` from `@mingle/shared`; existing `PrismaService`; models `Profile` (`findUnique({where:{userId}})`), `PartyParticipant` (composite key `partyId_profileId`), `PartyMessage`.
- Produces: `assertParticipant(userId: string, partyId: string): Promise<string | null>`; `addPartyMessage(profileId: string, partyId: string, content: string): Promise<PartyMessageView>`; `getPartyMessages(partyId: string, limit?: number): Promise<PartyMessageView[]>` (ascending `createdAt`, limit clamped 1–100, default 50). Tasks 3 relies on all three.

- [ ] **Step 1: Write the failing tests** — create `apps/backend/src/party/party.service.spec.ts`

```ts
import { BadRequestException } from "@nestjs/common";
import { PartyService } from "./party.service";

const prisma = {
  profile: { findUnique: jest.fn() },
  partyParticipant: { findUnique: jest.fn() },
  partyMessage: { create: jest.fn(), findMany: jest.fn() },
  party: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
} as any;

const service = new PartyService(prisma);
beforeEach(() => jest.clearAllMocks());

const ROW = {
  id: "m1",
  partyId: "pt1",
  profileId: "pf1",
  content: "hi",
  createdAt: new Date("2026-07-09T00:00:00Z"),
};

describe("assertParticipant", () => {
  it("returns the profileId for a participant", async () => {
    prisma.profile.findUnique.mockResolvedValue({ id: "pf1" });
    prisma.partyParticipant.findUnique.mockResolvedValue({ partyId: "pt1", profileId: "pf1" });
    await expect(service.assertParticipant("u1", "pt1")).resolves.toBe("pf1");
    expect(prisma.partyParticipant.findUnique).toHaveBeenCalledWith({
      where: { partyId_profileId: { partyId: "pt1", profileId: "pf1" } },
    });
  });
  it("returns null for a non-participant", async () => {
    prisma.profile.findUnique.mockResolvedValue({ id: "pf1" });
    prisma.partyParticipant.findUnique.mockResolvedValue(null);
    await expect(service.assertParticipant("u1", "pt1")).resolves.toBeNull();
  });
  it("returns null when the caller has no profile", async () => {
    prisma.profile.findUnique.mockResolvedValue(null);
    await expect(service.assertParticipant("u1", "pt1")).resolves.toBeNull();
    expect(prisma.partyParticipant.findUnique).not.toHaveBeenCalled();
  });
});

describe("addPartyMessage", () => {
  it("persists a trimmed message and returns the view", async () => {
    prisma.partyMessage.create.mockResolvedValue(ROW);
    const view = await service.addPartyMessage("pf1", "pt1", "  hi  ");
    expect(prisma.partyMessage.create).toHaveBeenCalledWith({
      data: { partyId: "pt1", profileId: "pf1", content: "hi" },
    });
    expect(view).toEqual({
      id: "m1",
      partyId: "pt1",
      profileId: "pf1",
      content: "hi",
      createdAt: "2026-07-09T00:00:00.000Z",
    });
  });
  it("rejects an empty message", async () => {
    await expect(service.addPartyMessage("pf1", "pt1", "   ")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it("rejects a message over 2000 chars", async () => {
    await expect(service.addPartyMessage("pf1", "pt1", "a".repeat(2001))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("getPartyMessages", () => {
  it("returns ascending views (desc query reversed) with default limit 50", async () => {
    const older = { ...ROW, id: "m0", createdAt: new Date("2026-07-08T00:00:00Z") };
    prisma.partyMessage.findMany.mockResolvedValue([ROW, older]);
    const list = await service.getPartyMessages("pt1");
    expect(prisma.partyMessage.findMany).toHaveBeenCalledWith({
      where: { partyId: "pt1" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    expect(list.map((m) => m.id)).toEqual(["m0", "m1"]);
  });
  it("clamps the limit to 100", async () => {
    prisma.partyMessage.findMany.mockResolvedValue([]);
    await service.getPartyMessages("pt1", 999);
    expect(prisma.partyMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @mingle/backend exec jest party.service 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|FAIL"`
Expected: FAIL (methods do not exist).

- [ ] **Step 3: Implement in `apps/backend/src/party/party.service.ts`**

Change the imports line to `import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";`, add `import type { PartyMessageView } from "@mingle/shared";`, and append inside the class:

```ts
  /** Resolve the caller's profileId iff they are a participant of the party; else null. */
  async assertParticipant(userId: string, partyId: string): Promise<string | null> {
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me) return null;
    const participant = await this.prisma.partyParticipant.findUnique({
      where: { partyId_profileId: { partyId, profileId: me.id } },
    });
    return participant ? me.id : null;
  }

  async addPartyMessage(
    profileId: string,
    partyId: string,
    content: string,
  ): Promise<PartyMessageView> {
    const trimmed = (content ?? "").trim();
    if (!trimmed || trimmed.length > 2000) {
      throw new BadRequestException("메시지는 1~2000자여야 합니다");
    }
    const row = await this.prisma.partyMessage.create({
      data: { partyId, profileId, content: trimmed },
    });
    return this.toMessageView(row);
  }

  async getPartyMessages(partyId: string, limit = 50): Promise<PartyMessageView[]> {
    const take = Math.min(Math.max(Math.floor(limit) || 50, 1), 100);
    const rows = await this.prisma.partyMessage.findMany({
      where: { partyId },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.reverse().map((r) => this.toMessageView(r));
  }

  private toMessageView(row: {
    id: string;
    partyId: string;
    profileId: string;
    content: string;
    createdAt: Date;
  }): PartyMessageView {
    return {
      id: row.id,
      partyId: row.partyId,
      profileId: row.profileId,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    };
  }
```

- [ ] **Step 4: Run to verify pass + build**

Run:
```
pnpm --filter @mingle/backend exec jest party.service 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|FAIL"
pnpm --filter @mingle/shared build >/dev/null 2>&1 && pnpm --filter @mingle/backend build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN
```
Expected: 8 passed; CLEAN.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/party/party.service.ts apps/backend/src/party/party.service.spec.ts
git commit -m "feat(party): assertParticipant + party message persistence/history"
```

---

### Task 3: backend PartyGateway + messages endpoint + module wiring (TDD)

**Files:**
- Create: `apps/backend/src/party/party.gateway.ts`
- Modify: `apps/backend/src/party/party.controller.ts`
- Modify: `apps/backend/src/party/party.module.ts`
- Test: `apps/backend/src/party/party.gateway.spec.ts` (create)

**Interfaces:**
- Consumes: Task 2's `assertParticipant`/`addPartyMessage`/`getPartyMessages`; `JwtService` (via `AuthModule`, mirroring `MessengerModule`); `JwtAuthGuard` + `CurrentUser`/`JwtPayload` from `../common/...`.
- Produces: socket events `party:join|leave|chat|move` (in) and `party:presence|party:message|party:moved|error` (out); `GET /parties/:id/messages`. Tasks 4–5 rely on these exact event names.

- [ ] **Step 1: Write the failing gateway tests** — create `apps/backend/src/party/party.gateway.spec.ts` (mirrors `messenger.gateway.spec.ts`)

```ts
import { PartyGateway } from "./party.gateway";

const jwt = { verify: jest.fn() } as any;
const party = {
  assertParticipant: jest.fn(),
  addPartyMessage: jest.fn(),
} as any;

function gatewayWith() {
  const gw = new PartyGateway(jwt, party);
  (gw as any).server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
  return gw;
}

function clientWith(userId?: string) {
  return {
    id: `sock-${Math.random()}`,
    data: userId ? { userId } : {},
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    disconnect: jest.fn(),
    handshake: { auth: {} },
  } as any;
}

beforeEach(() => jest.clearAllMocks());

it("handleConnection with no token disconnects", () => {
  const gw = gatewayWith();
  const client = clientWith();
  gw.handleConnection(client);
  expect(client.disconnect).toHaveBeenCalled();
});

it("handleConnection with invalid token disconnects without throwing", () => {
  jwt.verify.mockImplementationOnce(() => {
    throw new Error("bad");
  });
  const gw = gatewayWith();
  const client = clientWith();
  client.handshake.auth.token = "bad.token";
  expect(() => gw.handleConnection(client)).not.toThrow();
  expect(client.disconnect).toHaveBeenCalled();
});

it("party:join joins the room, registers presence, broadcasts the roster", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  expect(client.join).toHaveBeenCalledWith("pt1");
  expect(to).toHaveBeenCalledWith("pt1");
  const emit = to.mock.results[0].value.emit;
  expect(emit).toHaveBeenCalledWith("party:presence", { partyId: "pt1", members: ["pf1"] });
});

it("party:join refuses a non-participant with an error emit", async () => {
  party.assertParticipant.mockResolvedValueOnce(null);
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  expect(client.join).not.toHaveBeenCalled();
  expect(client.emit).toHaveBeenCalledWith("error", { message: "forbidden" });
});

it("party:chat persists then broadcasts party:message to the room", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const view = { id: "m1", partyId: "pt1", profileId: "pf1", content: "hi", createdAt: "t" };
  party.addPartyMessage.mockResolvedValueOnce(view);
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleChat(client, { partyId: "pt1", content: "hi" });
  expect(party.addPartyMessage).toHaveBeenCalledWith("pf1", "pt1", "hi");
  expect(to).toHaveBeenCalledWith("pt1");
  expect(to.mock.results[0].value.emit).toHaveBeenCalledWith("party:message", view);
});

it("party:chat surfaces a validation failure as an error emit (no throw)", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  party.addPartyMessage.mockRejectedValueOnce(new Error("bad"));
  const gw = gatewayWith();
  const client = clientWith("u1");
  await expect(gw.handleChat(client, { partyId: "pt1", content: "" })).resolves.toBeUndefined();
  expect(client.emit).toHaveBeenCalledWith("error", { message: "invalid" });
});

it("party:move broadcasts party:moved to others using join-time membership", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  gw.handleMove(client, { partyId: "pt1", x: 1, y: 2 });
  expect(client.to).toHaveBeenCalledWith("pt1");
  expect(client.to.mock.results[0].value.emit).toHaveBeenCalledWith("party:moved", {
    profileId: "pf1",
    x: 1,
    y: 2,
  });
});

it("party:move from a socket that never joined is ignored", () => {
  const gw = gatewayWith();
  const client = clientWith("u1");
  gw.handleMove(client, { partyId: "pt1", x: 1, y: 2 });
  expect(client.to).not.toHaveBeenCalled();
});

it("handleDisconnect removes presence and re-broadcasts the roster", async () => {
  party.assertParticipant.mockResolvedValue("pf1");
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  gw.handleDisconnect(client);
  const lastEmit = to.mock.results.at(-1)!.value.emit;
  expect(lastEmit).toHaveBeenCalledWith("party:presence", { partyId: "pt1", members: [] });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @mingle/backend exec jest party.gateway 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|FAIL|Cannot find"`
Expected: FAIL (`party.gateway` does not exist).

- [ ] **Step 3: Create `apps/backend/src/party/party.gateway.ts`**

```ts
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { PartyService } from "./party.service";

@WebSocketGateway({ cors: { origin: true } })
export class PartyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  /** partyId → (socketId → profileId). Presence is ephemeral by design. */
  private readonly presence = new Map<string, Map<string, string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly party: PartyService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) return client.disconnect();
      const payload = this.jwt.verify(token) as { sub: string };
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    for (const [partyId, members] of this.presence) {
      if (members.delete(client.id)) this.broadcastPresence(partyId);
    }
  }

  @SubscribeMessage("party:join")
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { partyId: string }) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    await client.join(body.partyId);
    let members = this.presence.get(body.partyId);
    if (!members) {
      members = new Map();
      this.presence.set(body.partyId, members);
    }
    members.set(client.id, me);
    this.broadcastPresence(body.partyId);
  }

  @SubscribeMessage("party:leave")
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { partyId: string }) {
    if (!body?.partyId) return;
    void client.leave(body.partyId);
    const members = this.presence.get(body.partyId);
    if (members?.delete(client.id)) this.broadcastPresence(body.partyId);
  }

  @SubscribeMessage("party:chat")
  async handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string; content: string },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const message = await this.party.addPartyMessage(me, body.partyId, body.content);
      this.server.to(body.partyId).emit("party:message", message);
    } catch {
      client.emit("error", { message: "invalid" });
    }
  }

  @SubscribeMessage("party:move")
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string; x: number; y: number },
  ) {
    // Membership was proven at party:join — the presence map is the (cheap) authority here.
    const me = this.presence.get(body?.partyId)?.get(client.id);
    if (!me || typeof body.x !== "number" || typeof body.y !== "number") return;
    client.to(body.partyId).emit("party:moved", { profileId: me, x: body.x, y: body.y });
  }

  private async authorize(client: Socket, partyId?: string): Promise<string | null> {
    if (!client.data.userId || !partyId) {
      client.emit("error", { message: "forbidden" });
      return null;
    }
    const me = await this.party.assertParticipant(client.data.userId, partyId);
    if (!me) {
      client.emit("error", { message: "forbidden" });
      return null;
    }
    return me;
  }

  private broadcastPresence(partyId: string) {
    const members = [...new Set(this.presence.get(partyId)?.values() ?? [])];
    this.server.to(partyId).emit("party:presence", { partyId, members });
  }
}
```

- [ ] **Step 4: Add the messages endpoint** — in `apps/backend/src/party/party.controller.ts`, extend the imports and add the route **above** `@Get(":id")` (clarity; the two-segment path cannot collide anyway):

Replace the `@nestjs/common` import with:
```ts
import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
```
Add below the swagger import:
```ts
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, type JwtPayload } from "../common/decorators/current-user.decorator";
```
(keep a single `ApiTags` import — merge with the existing line) and add the route inside the class:

```ts
  @Get(":id/messages")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMessages(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const me = await this.partyService.assertParticipant(user.userId, id);
    if (!me) throw new ForbiddenException("파티 참가자가 아닙니다");
    return this.partyService.getPartyMessages(id);
  }
```

- [ ] **Step 5: Wire the module** — replace `apps/backend/src/party/party.module.ts` with:

```ts
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PartyController } from "./party.controller";
import { PartyService } from "./party.service";
import { PartyGateway } from "./party.gateway";

@Module({
  imports: [AuthModule],
  controllers: [PartyController],
  providers: [PartyService, PartyGateway],
  exports: [PartyService],
})
export class PartyModule {}
```

- [ ] **Step 6: Verify — gateway tests, full suite, build, boot**

Run:
```
pnpm --filter @mingle/backend exec jest party 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|Suites:|FAIL"
pnpm --filter @mingle/backend test 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|Suites:|FAIL"
pnpm --filter @mingle/backend build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN
```
Expected: party suites green (17 tests: 8 service + 9 gateway); full suite ≥150 all pass; build CLEAN. Boot check (docker `docker compose up -d` first if the DB is down):
`(cd apps/backend && node -e "require('child_process').execSync('node dist/main.js',{timeout:9000,stdio:'inherit'})") 2>&1 | grep -iE "parties/:id/messages|successfully started" | head` → the route mapped + Nest started.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/party/party.gateway.ts apps/backend/src/party/party.gateway.spec.ts apps/backend/src/party/party.controller.ts apps/backend/src/party/party.module.ts
git commit -m "feat(party): realtime gateway (presence/chat/move) + GET /parties/:id/messages"
```

---

### Task 4: client-core — party socket wrapper + history API (TDD)

**Files:**
- Create: `packages/client-core/src/socket/party-socket.ts`
- Create: `packages/client-core/src/api/party.ts`
- Modify: `packages/client-core/src/index.ts`
- Test: `packages/client-core/src/__tests__/party-realtime.test.ts` (create)

**Interfaces:**
- Consumes: Task 1's shared types; `apiFetch` from `./client.js`; Task 3's event names.
- Produces (barrel): `getPartyMessages(partyId): Promise<PartyMessageView[]>`; `connectPartySocket(opts): PartySocketHandle`; types `PartySocketHandlers { onMessage?, onPresence?, onMoved?, onError?, onReconnect? }`, `PartySocketHandle { joinParty, leaveParty, sendChat, move, disconnect }`. Task 5 relies on these names.

- [ ] **Step 1: Write the failing tests** — create `packages/client-core/src/__tests__/party-realtime.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../api/client.js";
import { getPartyMessages, connectPartySocket } from "../index.js";

const fetchMock = vi.spyOn(client, "apiFetch").mockResolvedValue(undefined as never);
beforeEach(() => fetchMock.mockClear());

describe("getPartyMessages", () => {
  it("GETs the party message history", async () => {
    await getPartyMessages("pt1");
    expect(fetchMock).toHaveBeenCalledWith("/parties/pt1/messages");
  });
});

describe("connectPartySocket", () => {
  it("connects with websocket transport + token auth", () => {
    const mockSocket = { on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
    const factory = vi.fn().mockReturnValue(mockSocket);
    connectPartySocket({ ioFactory: factory, baseUrl: "http://x", token: "tok", handlers: {} });
    expect(factory).toHaveBeenCalledWith("http://x", {
      auth: { token: "tok" },
      transports: ["websocket"],
    });
  });

  it("emits party:join / party:leave / party:chat / party:move with correct payloads", () => {
    const emitted: unknown[][] = [];
    const mockSocket = { on: vi.fn(), emit: (...a: unknown[]) => emitted.push(a), disconnect: vi.fn() };
    const handle = connectPartySocket({
      ioFactory: vi.fn().mockReturnValue(mockSocket),
      baseUrl: "",
      token: "",
      handlers: {},
    });
    handle.joinParty("pt1");
    handle.sendChat("pt1", "hello");
    handle.move("pt1", 3, 4);
    handle.leaveParty("pt1");
    expect(emitted).toEqual([
      ["party:join", { partyId: "pt1" }],
      ["party:chat", { partyId: "pt1", content: "hello" }],
      ["party:move", { partyId: "pt1", x: 3, y: 4 }],
      ["party:leave", { partyId: "pt1" }],
    ]);
  });

  it("wires handlers to party:message / party:presence / party:moved / error", () => {
    const listeners = new Map<string, (e: unknown) => void>();
    const mockSocket = {
      on: (ev: string, fn: (e: unknown) => void) => listeners.set(ev, fn),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };
    const onMessage = vi.fn();
    const onPresence = vi.fn();
    const onMoved = vi.fn();
    connectPartySocket({
      ioFactory: vi.fn().mockReturnValue(mockSocket),
      baseUrl: "",
      token: "",
      handlers: { onMessage, onPresence, onMoved },
    });
    listeners.get("party:message")!({ id: "m1" });
    listeners.get("party:presence")!({ partyId: "pt1", members: ["pf1"] });
    listeners.get("party:moved")!({ profileId: "pf1", x: 1, y: 2 });
    expect(onMessage).toHaveBeenCalledWith({ id: "m1" });
    expect(onPresence).toHaveBeenCalledWith({ partyId: "pt1", members: ["pf1"] });
    expect(onMoved).toHaveBeenCalledWith({ profileId: "pf1", x: 1, y: 2 });
  });

  it("re-joins tracked parties after a reconnect (second connect event)", () => {
    const emitted: unknown[][] = [];
    let connectCb: (() => void) | undefined;
    const mockSocket = {
      on: (ev: string, fn: () => void) => {
        if (ev === "connect") connectCb = fn;
      },
      emit: (...a: unknown[]) => emitted.push(a),
      disconnect: vi.fn(),
    };
    const onReconnect = vi.fn();
    const handle = connectPartySocket({
      ioFactory: vi.fn().mockReturnValue(mockSocket),
      baseUrl: "",
      token: "",
      handlers: { onReconnect },
    });
    handle.joinParty("pt1");
    connectCb!(); // first connect — skipped
    expect(onReconnect).not.toHaveBeenCalled();
    connectCb!(); // reconnect
    expect(emitted.filter((e) => e[0] === "party:join")).toHaveLength(2);
    expect(onReconnect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @mingle/client-core test 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "FAIL|Cannot find"`
Expected: FAIL (unresolved exports).

- [ ] **Step 3: Create `packages/client-core/src/api/party.ts`**

```ts
import type { PartyMessageView } from "@mingle/shared";
import { apiFetch } from "./client.js";

export function getPartyMessages(partyId: string): Promise<PartyMessageView[]> {
  return apiFetch<PartyMessageView[]>(`/parties/${partyId}/messages`);
}
```

- [ ] **Step 4: Create `packages/client-core/src/socket/party-socket.ts`** (mirrors `messenger-socket.ts`)

```ts
import type { PartyMessageView, PartyMove, PartyPresence } from "@mingle/shared";

export interface PartySocketHandlers {
  onMessage?: (e: PartyMessageView) => void;
  onPresence?: (e: PartyPresence) => void;
  onMoved?: (e: PartyMove) => void;
  onError?: (e: unknown) => void;
  /** Called after auto-rejoin on socket reconnect. Use to refetch history to fill any gap. */
  onReconnect?: () => void;
}

export interface PartySocketHandle {
  joinParty(partyId: string): void;
  leaveParty(partyId: string): void;
  sendChat(partyId: string, content: string): void;
  move(partyId: string, x: number, y: number): void;
  disconnect(): void;
}

/** `ioFactory` is `socket.io-client`'s `io` (injected by the platform). */
export function connectPartySocket(opts: {
  ioFactory: (url: string, options: unknown) => any;
  baseUrl: string;
  token: string;
  handlers: PartySocketHandlers;
}): PartySocketHandle {
  const socket = opts.ioFactory(opts.baseUrl, {
    auth: { token: opts.token },
    transports: ["websocket"],
  });
  const { onMessage, onPresence, onMoved, onError, onReconnect } = opts.handlers;

  // Track joined parties so we can re-join automatically after a transient disconnect.
  const joinedParties = new Set<string>();
  let firstConnect = true;

  if (onMessage) socket.on("party:message", onMessage);
  if (onPresence) socket.on("party:presence", onPresence);
  if (onMoved) socket.on("party:moved", onMoved);
  if (onError) socket.on("error", onError);

  // socket.io fires "connect" on every (re)connection; skip the very first so we
  // don't double-join on initial connect (joinParty already emits party:join).
  socket.on("connect", () => {
    if (firstConnect) {
      firstConnect = false;
      return;
    }
    for (const partyId of joinedParties) {
      socket.emit("party:join", { partyId });
    }
    onReconnect?.();
  });

  return {
    joinParty: (partyId) => {
      joinedParties.add(partyId);
      socket.emit("party:join", { partyId });
    },
    leaveParty: (partyId) => {
      joinedParties.delete(partyId);
      socket.emit("party:leave", { partyId });
    },
    sendChat: (partyId, content) => socket.emit("party:chat", { partyId, content }),
    move: (partyId, x, y) => socket.emit("party:move", { partyId, x, y }),
    disconnect: () => socket.disconnect(),
  };
}
```

- [ ] **Step 5: Barrel** — add to `packages/client-core/src/index.ts` (next to the messenger-socket exports):

```ts
export { getPartyMessages } from "./api/party.js";
export { connectPartySocket } from "./socket/party-socket.js";
export type { PartySocketHandlers, PartySocketHandle } from "./socket/party-socket.js";
```

- [ ] **Step 6: Run to verify pass + full suite + build**

Run:
```
pnpm --filter @mingle/client-core test 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Test Files|Tests |FAIL"
pnpm --filter @mingle/client-core build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN
```
Expected: 57 passed (5 new + 52); CLEAN.

- [ ] **Step 7: Commit**

```bash
git add packages/client-core/src/api/party.ts packages/client-core/src/socket/party-socket.ts packages/client-core/src/index.ts packages/client-core/src/__tests__/party-realtime.test.ts
git commit -m "feat(client-core): party socket wrapper + message history API"
```

---

### Task 5: mobile — party chat + presence section

**Files:**
- Create: `apps/mobile/src/lib/party-socket.ts`
- Modify: `apps/mobile/app/(app)/party/[id].tsx`

**Interfaces:**
- Consumes: `connectPartySocket`, `getPartyMessages`, `type PartySocketHandlers`, `type PartySocketHandle`, `type PartyMessageView` (from `@mingle/client-core` — re-export `PartyMessageView` there if not already surfaced via `@mingle/shared`; the mobile app imports ONLY from `@mingle/client-core`); `useAuthStore` (`s.token`, `s.profileId`) from `../../../src/lib/client`.
- Produces: the live chat + presence UI. (6b will reuse `openPartySocket` and the handle's `move`/`onMoved`.)

**Note:** if `PartyMessageView` is not exported from `@mingle/client-core`, add `export type { PartyMessageView, PartyPresence, PartyMove } from "@mingle/shared";` to the client-core barrel as part of THIS task (one line; keeps mobile off a direct shared dep, mirroring how `PeerProfile` is re-exported).

- [ ] **Step 1: Create `apps/mobile/src/lib/party-socket.ts`** (mirrors `messenger-socket.ts`)

```ts
import { io } from "socket.io-client";
import { connectPartySocket, type PartySocketHandlers } from "@mingle/client-core";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export function openPartySocket(token: string, handlers: PartySocketHandlers) {
  return connectPartySocket({ ioFactory: io as never, baseUrl: BASE, token, handlers });
}
```

- [ ] **Step 2: Add the chat + presence section to `apps/mobile/app/(app)/party/[id].tsx`**

Extend the imports:
```tsx
import { TextInput } from "react-native"; // merge into the existing react-native import list
import type { PartyMessageView, PartySocketHandle } from "@mingle/client-core";
import { getPartyMessages } from "@mingle/client-core";
import { openPartySocket } from "../../../src/lib/party-socket";
```
(also add `useAuthStore((s) => s.token)` alongside the existing `profileId` selector.)

Add state + socket lifecycle inside `PartyScreen` (after the existing state):
```tsx
  const token = useAuthStore((s) => s.token);
  const [messages, setMessages] = useState<PartyMessageView[]>([]);
  const [presentCount, setPresentCount] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [socketDown, setSocketDown] = useState(false);
  const socketRef = useRef<PartySocketHandle | null>(null);

  useEffect(() => {
    if (!id || !token || !party) return;
    let alive = true;
    getPartyMessages(id)
      .then((history) => alive && setMessages(history))
      .catch(() => alive && setSocketDown(true));
    const handle = openPartySocket(token, {
      onMessage: (m) =>
        alive && setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
      onPresence: (p) => alive && setPresentCount(p.members.length),
      onError: () => alive && setSocketDown(true),
      onReconnect: () => {
        if (!alive) return;
        setSocketDown(false);
        getPartyMessages(id).then((h) => alive && setMessages(h)).catch(() => {});
      },
    });
    socketRef.current = handle;
    handle.joinParty(id);
    return () => {
      alive = false;
      handle.leaveParty(id);
      handle.disconnect();
      socketRef.current = null;
    };
  }, [id, token, party != null]);

  function onSendChat() {
    const content = chatInput.trim();
    if (!content || !id) return;
    socketRef.current?.sendChat(id, content);
    setChatInput("");
  }
```
(dependency `party != null` — connect once the party is loaded; eslint disable not needed, plain expression is fine.)

Add the section to the JSX, after the participants map and before the "홈으로" button:
```tsx
      <View style={styles.chatSection}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle}>파티 채팅</Text>
          <Text style={styles.presence}>{presentCount}명 접속 중</Text>
        </View>
        {socketDown ? <Text style={styles.chatNotice}>실시간 연결이 불안정해요</Text> : null}
        {messages.length === 0 ? (
          <Text style={styles.chatEmpty}>첫 메시지를 보내보세요</Text>
        ) : (
          messages.slice(-30).map((m) => {
            const sender = party.participants.find((p) => p.profileId === m.profileId);
            const mine = m.profileId === myProfileId;
            return (
              <View key={m.id} style={[styles.chatRow, mine && styles.chatRowMine]}>
                <Text style={styles.chatSender}>{mine ? "나" : (sender?.name ?? "??")}</Text>
                <Text style={styles.chatContent}>{m.content}</Text>
              </View>
            );
          })
        )}
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInputBox}
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="메시지 보내기"
            placeholderTextColor="#8A857C"
            maxLength={2000}
            onSubmitEditing={onSendChat}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.chatSendBtn} onPress={onSendChat}>
            <Text style={styles.chatSendText}>전송</Text>
          </TouchableOpacity>
        </View>
      </View>
```

Add the styles (all B&W):
```tsx
  chatSection: { borderWidth: 2, borderColor: "#17150F", borderRadius: 10, padding: 12, gap: 8 },
  chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatTitle: { fontSize: 15, fontWeight: "700", color: "#17150F" },
  presence: { fontSize: 12, color: "#45413A" },
  chatNotice: { fontSize: 12, color: "#8A857C" },
  chatEmpty: { fontSize: 13, color: "#8A857C", textAlign: "center", paddingVertical: 8 },
  chatRow: { gap: 2, paddingVertical: 2 },
  chatRowMine: { alignItems: "flex-end" },
  chatSender: { fontSize: 11, color: "#8A857C" },
  chatContent: { fontSize: 14, color: "#17150F" },
  chatInputRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  chatInputBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D9D5CC",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#17150F",
  },
  chatSendBtn: {
    backgroundColor: "#17150F",
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  chatSendText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
```

**Structural note:** the party screen's early returns (`error`, `!party`) stay above the hooks-in-effect — keep ALL new hooks (`useEffect`, new `useState`s) **before** the early returns to preserve the Rules of Hooks (move them up next to the existing state declarations; the `useEffect` already guards on `!party` via `party != null` in deps + the `if (!id || !token || !party) return;` body).

- [ ] **Step 3: Verify tsc CLEAN + vitest untouched**

Run:
```
pnpm --filter @mingle/shared build >/dev/null 2>&1 && pnpm --filter @mingle/client-core build >/dev/null 2>&1
cd apps/mobile && pnpm exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN
pnpm exec vitest run 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Test Files|Tests |FAIL"
```
Expected: CLEAN; 10/10 still pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/party-socket.ts "apps/mobile/app/(app)/party/[id].tsx" packages/client-core/src/index.ts
git commit -m "feat(mobile): live party chat + presence in the party room"
```
(`index.ts` only if the type re-export line was needed.)

---

## Plan Self-Review

**Spec coverage:** gateway protocol (join/leave/chat/move + presence/message/moved/error) → Task 3; service assert/persist/history → Task 2; `GET /parties/:id/messages` (403 non-member) → Task 3; shared types → Task 1; client-core wrapper + API → Task 4; mobile chat+presence UI → Task 5; no-migration constraint → no schema task (correct); block-filtering/CORS/2D-render → explicitly out of scope. No gaps.

**Placeholder scan:** none — every code step is complete, every command has expected output.

**Type consistency:** `assertParticipant(userId, partyId) → string|null` used identically in Tasks 2/3; `addPartyMessage(profileId, partyId, content) → PartyMessageView` in 2/3; event names `party:join|leave|chat|move|presence|message|moved` identical across 3/4/5; `PartySocketHandle { joinParty, leaveParty, sendChat, move, disconnect }` identical in 4/5; `PartyMessageView.createdAt: string` (ISO) in 1/2/4/5.
