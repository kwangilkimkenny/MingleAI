# Phase 0 — Foundation: `@mingle/client-core` + Expo Mobile Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a platform-agnostic `@mingle/client-core` package (API client + auth store + storage abstraction) and scaffold an Expo (React Native) app that logs into the existing NestJS backend on iOS and Android.

**Architecture:** Extract the web app's HTTP/auth logic into a new monorepo package whose only platform couplings — token storage and the API base URL — are injected at startup. The existing backend and Next.js web app are left untouched (web is being minimized per the v2 plan, so we do not refactor it now). A new `apps/mobile` Expo app consumes `client-core`, injecting `expo-secure-store` for token storage and an absolute API base URL, and ships a working email/password login flow.

**Tech Stack:** TypeScript (Node16 ESM), Zustand (vanilla via `zustand` `create`), Vitest (unit tests for `client-core`), Expo SDK + Expo Router, expo-secure-store, pnpm workspaces.

## Global Constraints

- Package manager: **pnpm** workspaces; Node **>=18** (dev env is Node 26, pnpm 10.34). One line each below copied from the repo:
- Monorepo globs: `packages/*` and `apps/*` (new dirs auto-included — no `pnpm-workspace.yaml` edit needed).
- TS config: all packages `extends ../../tsconfig.base.json` which sets `module: Node16`, `moduleResolution: Node16`, `strict: true`, `composite: true`, `declaration: true`. **Relative imports MUST use `.js` extensions** (e.g. `./config.js`), matching `@mingle/shared`.
- Package type: ESM (`"type": "module"`) like `@mingle/shared` and `@mingle/mcp`.
- Backend routes have **no `/api` prefix** (web adds `/api` via a Next.js rewrite to `http://localhost:3000`). `client-core` therefore builds URLs as `` `${baseUrl}${path}` `` and each app supplies `baseUrl` (web → `/api`, mobile → absolute URL).
- Auth response shape from backend: `{ "accessToken": string }` for both `/auth/register` and `/auth/login`.
- Do **not** modify `apps/backend` or `apps/web` in this plan.

---

## File Structure

```
packages/client-core/
├── package.json                 # @mingle/client-core, ESM, builds to dist
├── tsconfig.json                # extends base; adds DOM lib for fetch types
├── vitest.config.ts             # node env
└── src/
    ├── index.ts                 # public barrel
    ├── config.ts                # baseUrl + onUnauthorized + token accessor bridge
    ├── storage.ts               # KeyValueStorage interface + createMemoryStorage
    ├── auth-store.ts            # createAuthStore(storage) factory (Zustand + persist)
    ├── api/
    │   ├── client.ts            # apiFetch + ApiError (platform-agnostic)
    │   └── auth.ts              # register / login
    └── __tests__/
        ├── client.test.ts
        ├── auth-store.test.ts
        └── auth-api.test.ts

apps/mobile/
├── package.json
├── app.json                     # Expo config
├── tsconfig.json
├── metro.config.js              # pnpm-monorepo-aware Metro config
├── .env.example                 # EXPO_PUBLIC_API_URL
├── babel.config.js
├── app/
│   ├── _layout.tsx              # root stack + auth bootstrap
│   ├── index.tsx                # redirect by auth state
│   ├── login.tsx
│   ├── register.tsx
│   └── (app)/
│       ├── _layout.tsx          # protected group
│       └── home.tsx
└── src/lib/
    ├── secure-storage.ts        # expo-secure-store → KeyValueStorage
    └── client.ts                # creates useAuthStore + configures client-core
```

---

## Subsequent plans (NOT in this plan — written later, in order)
1. **Phase 1** — Data model v2 migration + backend domain pivot (remove AI-conversation/3D remnants; add matchmaking/proposal/match/messenger/block models).
2. **Phase 1b** — Onboarding (gender/age/job + NL preference) + AI preference analysis.
3. **Phase 2** — Matchmaking queue + party rooms + 2D Skia view + realtime chat.
4. **Phase 3** — Icebreaker minigames.
5. **Phase 4** — Proposal → match → 1:1 messenger + push notifications.
6. **Phase 5** — Restaurant reservation + store submission (EAS).

---

## Task 1: Scaffold `@mingle/client-core` package

**Files:**
- Create: `packages/client-core/package.json`
- Create: `packages/client-core/tsconfig.json`
- Create: `packages/client-core/vitest.config.ts`
- Create: `packages/client-core/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: an installable workspace package `@mingle/client-core` that builds to `dist/` and runs Vitest. Empty barrel for now.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@mingle/client-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zustand": "^5.0.0"
  },
  "peerDependencies": {
    "react": ">=18"
  },
  "devDependencies": {
    "react": "^19.0.0",
    "@types/react": "^19.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
}
```

(The `DOM` lib supplies `fetch`/`RequestInit`/`Response` types; the actual `fetch` is provided at runtime by the browser, React Native, or Node. `jsx` is set for safety though this package ships no JSX.)

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create empty barrel `src/index.ts`**

```ts
export {};
```

- [ ] **Step 5: Install and verify the package is wired**

Run: `pnpm install`
Expected: completes; `@mingle/client-core` appears in the workspace (no errors).

- [ ] **Step 6: Verify build and test run**

Run: `pnpm --filter @mingle/client-core build && pnpm --filter @mingle/client-core test`
Expected: `tsc` produces `dist/index.js`; Vitest reports `No test files found` (exit 0 with `vitest run` and no tests is acceptable — proceed).

- [ ] **Step 7: Commit**

```bash
git add packages/client-core pnpm-lock.yaml
git commit -m "chore(client-core): scaffold @mingle/client-core package"
```

---

## Task 2: Config + token-accessor bridge (`config.ts`)

**Files:**
- Create: `packages/client-core/src/config.ts`
- Test: `packages/client-core/src/__tests__/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface ClientConfig { baseUrl: string; onUnauthorized?: () => void }`
  - `configureClient(config: ClientConfig): void`
  - `getClientConfig(): ClientConfig`
  - `setTokenAccessor(fn: () => string | null): void`
  - `getToken(): string | null`

- [ ] **Step 1: Write the failing test** — `src/__tests__/config.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  configureClient,
  getClientConfig,
  setTokenAccessor,
  getToken,
} from "../config.js";

describe("config", () => {
  beforeEach(() => {
    configureClient({ baseUrl: "" });
    setTokenAccessor(() => null);
  });

  it("stores and returns the client config", () => {
    const onUnauthorized = () => {};
    configureClient({ baseUrl: "http://x", onUnauthorized });
    expect(getClientConfig().baseUrl).toBe("http://x");
    expect(getClientConfig().onUnauthorized).toBe(onUnauthorized);
  });

  it("defaults token to null and returns the injected token", () => {
    expect(getToken()).toBeNull();
    setTokenAccessor(() => "tok-123");
    expect(getToken()).toBe("tok-123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/client-core test`
Expected: FAIL — cannot find module `../config.js`.

- [ ] **Step 3: Write minimal implementation** — `src/config.ts`

```ts
export interface ClientConfig {
  baseUrl: string;
  onUnauthorized?: () => void;
}

let config: ClientConfig = { baseUrl: "" };
let tokenAccessor: () => string | null = () => null;

export function configureClient(next: ClientConfig): void {
  config = next;
}

export function getClientConfig(): ClientConfig {
  return config;
}

export function setTokenAccessor(fn: () => string | null): void {
  tokenAccessor = fn;
}

export function getToken(): string | null {
  return tokenAccessor();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mingle/client-core test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/client-core/src/config.ts packages/client-core/src/__tests__/config.test.ts
git commit -m "feat(client-core): add config and token-accessor bridge"
```

---

## Task 3: Storage abstraction (`storage.ts`)

**Files:**
- Create: `packages/client-core/src/storage.ts`
- Test: `packages/client-core/src/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface KeyValueStorage { getItem(name): string|null|Promise<string|null>; setItem(name,value): void|Promise<void>; removeItem(name): void|Promise<void> }`
  - `createMemoryStorage(): KeyValueStorage`

- [ ] **Step 1: Write the failing test** — `src/__tests__/storage.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createMemoryStorage } from "../storage.js";

describe("createMemoryStorage", () => {
  it("round-trips and removes values", async () => {
    const s = createMemoryStorage();
    expect(await s.getItem("k")).toBeNull();
    await s.setItem("k", "v");
    expect(await s.getItem("k")).toBe("v");
    await s.removeItem("k");
    expect(await s.getItem("k")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/client-core test`
Expected: FAIL — cannot find module `../storage.js`.

- [ ] **Step 3: Write minimal implementation** — `src/storage.ts`

```ts
export interface KeyValueStorage {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}

export function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (name) => (map.has(name) ? map.get(name)! : null),
    setItem: (name, value) => {
      map.set(name, value);
    },
    removeItem: (name) => {
      map.delete(name);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mingle/client-core test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client-core/src/storage.ts packages/client-core/src/__tests__/storage.test.ts
git commit -m "feat(client-core): add KeyValueStorage abstraction + memory storage"
```

---

## Task 4: Auth store factory (`auth-store.ts`)

**Files:**
- Create: `packages/client-core/src/auth-store.ts`
- Test: `packages/client-core/src/__tests__/auth-store.test.ts`

**Interfaces:**
- Consumes: `KeyValueStorage` from `./storage.js`.
- Produces:
  - `type UserRole = "user" | "admin" | "super_admin"`
  - `interface AuthState { token: string|null; profileId: string|null; role: UserRole|null; setAuth(data:{token:string;profileId?:string;role?:UserRole}):void; logout():void; isAdmin():boolean }`
  - `createAuthStore(storage: KeyValueStorage)` → a Zustand bound hook (`UseBoundStore`) with `.getState()`, persisted under key `"mingle-auth"`.

- [ ] **Step 1: Write the failing test** — `src/__tests__/auth-store.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createAuthStore } from "../auth-store.js";
import { createMemoryStorage } from "../storage.js";

describe("createAuthStore", () => {
  it("starts logged out", () => {
    const store = createAuthStore(createMemoryStorage());
    expect(store.getState().token).toBeNull();
    expect(store.getState().isAdmin()).toBe(false);
  });

  it("sets auth and clears on logout", () => {
    const store = createAuthStore(createMemoryStorage());
    store.getState().setAuth({ token: "t", profileId: "p", role: "admin" });
    expect(store.getState().token).toBe("t");
    expect(store.getState().profileId).toBe("p");
    expect(store.getState().isAdmin()).toBe(true);
    store.getState().logout();
    expect(store.getState().token).toBeNull();
    expect(store.getState().role).toBeNull();
  });

  it("preserves existing profileId when setAuth omits it", () => {
    const store = createAuthStore(createMemoryStorage());
    store.getState().setAuth({ token: "t1", profileId: "p1" });
    store.getState().setAuth({ token: "t2" });
    expect(store.getState().profileId).toBe("p1");
    expect(store.getState().token).toBe("t2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/client-core test`
Expected: FAIL — cannot find module `../auth-store.js`.

- [ ] **Step 3: Write minimal implementation** — `src/auth-store.ts`

```ts
import { create, type UseBoundStore, type StoreApi } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { KeyValueStorage } from "./storage.js";

export type UserRole = "user" | "admin" | "super_admin";

export interface AuthState {
  token: string | null;
  profileId: string | null;
  role: UserRole | null;
  setAuth: (data: { token: string; profileId?: string; role?: UserRole }) => void;
  logout: () => void;
  isAdmin: () => boolean;
}

export function createAuthStore(
  storage: KeyValueStorage,
): UseBoundStore<StoreApi<AuthState>> {
  return create<AuthState>()(
    persist(
      (set, get) => ({
        token: null,
        profileId: null,
        role: null,
        setAuth: ({ token, profileId, role }) =>
          set({
            token,
            profileId: profileId ?? get().profileId,
            role: role ?? get().role,
          }),
        logout: () => set({ token: null, profileId: null, role: null }),
        isAdmin: () => {
          const role = get().role;
          return role === "admin" || role === "super_admin";
        },
      }),
      { name: "mingle-auth", storage: createJSONStorage(() => storage) },
    ),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mingle/client-core test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/client-core/src/auth-store.ts packages/client-core/src/__tests__/auth-store.test.ts
git commit -m "feat(client-core): add createAuthStore factory with injectable storage"
```

---

## Task 5: `apiFetch` + `ApiError` (`api/client.ts`)

**Files:**
- Create: `packages/client-core/src/api/client.ts`
- Test: `packages/client-core/src/__tests__/client.test.ts`

**Interfaces:**
- Consumes: `getClientConfig`, `getToken` from `../config.js`.
- Produces:
  - `class ApiError extends Error { status: number }`
  - `apiFetch<T>(path: string, options?: RequestInit): Promise<T>` — prepends `baseUrl`, adds `Authorization: Bearer <token>` when present, calls `onUnauthorized` and throws `ApiError(401, ...)` on 401, throws `ApiError(status, body.message)` on other non-2xx, returns `undefined` on 204, else parses JSON.

- [ ] **Step 1: Write the failing test** — `src/__tests__/client.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiFetch, ApiError } from "../api/client.js";
import { configureClient, setTokenAccessor } from "../config.js";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe("apiFetch", () => {
  beforeEach(() => {
    configureClient({ baseUrl: "http://api.test" });
    setTokenAccessor(() => null);
  });

  it("prepends baseUrl and sends JSON content type", async () => {
    const f = mockFetch(200, { ok: true });
    vi.stubGlobal("fetch", f);
    await apiFetch("/ping");
    expect(f).toHaveBeenCalledWith(
      "http://api.test/ping",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });

  it("adds Authorization header when a token is present", async () => {
    const f = mockFetch(200, {});
    vi.stubGlobal("fetch", f);
    setTokenAccessor(() => "abc");
    await apiFetch("/secure");
    const headers = (f.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer abc");
  });

  it("calls onUnauthorized and throws ApiError(401) on 401", async () => {
    const onUnauthorized = vi.fn();
    configureClient({ baseUrl: "http://api.test", onUnauthorized });
    vi.stubGlobal("fetch", mockFetch(401, {}));
    await expect(apiFetch("/secure")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("throws ApiError with server message on non-2xx", async () => {
    vi.stubGlobal("fetch", mockFetch(400, { message: "bad input" }));
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 400, message: "bad input" });
  });

  it("returns undefined on 204", async () => {
    vi.stubGlobal("fetch", mockFetch(204, null));
    await expect(apiFetch("/no-content")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/client-core test`
Expected: FAIL — cannot find module `../api/client.js`.

- [ ] **Step 3: Write minimal implementation** — `src/api/client.ts`

```ts
import { getClientConfig, getToken } from "../config.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const { baseUrl, onUnauthorized } = getClientConfig();
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, "인증이 만료되었습니다.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message || `요청 실패 (${res.status})`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mingle/client-core test`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/client-core/src/api/client.ts packages/client-core/src/__tests__/client.test.ts
git commit -m "feat(client-core): add platform-agnostic apiFetch + ApiError"
```

---

## Task 6: Auth API + public barrel (`api/auth.ts`, `index.ts`)

**Files:**
- Create: `packages/client-core/src/api/auth.ts`
- Modify: `packages/client-core/src/index.ts`
- Test: `packages/client-core/src/__tests__/auth-api.test.ts`

**Interfaces:**
- Consumes: `apiFetch` from `./client.js`.
- Produces:
  - `interface AuthResponse { accessToken: string }`
  - `register(email: string, password: string): Promise<AuthResponse>`
  - `login(email: string, password: string): Promise<AuthResponse>`
  - Barrel exports: everything from `config`, `storage`, `auth-store`, `api/client`, `api/auth`.

- [ ] **Step 1: Write the failing test** — `src/__tests__/auth-api.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { login, register } from "../api/auth.js";
import { configureClient, setTokenAccessor } from "../config.js";

describe("auth api", () => {
  beforeEach(() => {
    configureClient({ baseUrl: "http://api.test" });
    setTokenAccessor(() => null);
  });

  it("POSTs credentials to /auth/login and returns accessToken", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: "jwt" }),
    } as Response);
    vi.stubGlobal("fetch", f);

    const res = await login("a@b.com", "pw");
    expect(res.accessToken).toBe("jwt");
    expect(f).toHaveBeenCalledWith(
      "http://api.test/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "a@b.com", password: "pw" }),
      }),
    );
  });

  it("POSTs to /auth/register", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: "jwt2" }),
    } as Response);
    vi.stubGlobal("fetch", f);

    const res = await register("c@d.com", "pw2");
    expect(res.accessToken).toBe("jwt2");
    expect(f.mock.calls[0][0]).toBe("http://api.test/auth/register");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/client-core test`
Expected: FAIL — cannot find module `../api/auth.js`.

- [ ] **Step 3: Write `src/api/auth.ts`**

```ts
import { apiFetch } from "./client.js";

export interface AuthResponse {
  accessToken: string;
}

export function register(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
```

- [ ] **Step 4: Replace `src/index.ts` with the public barrel**

```ts
export {
  configureClient,
  getClientConfig,
  setTokenAccessor,
  getToken,
} from "./config.js";
export type { ClientConfig } from "./config.js";

export { createMemoryStorage } from "./storage.js";
export type { KeyValueStorage } from "./storage.js";

export { createAuthStore } from "./auth-store.js";
export type { AuthState, UserRole } from "./auth-store.js";

export { apiFetch, ApiError } from "./api/client.js";

export { register, login } from "./api/auth.js";
export type { AuthResponse } from "./api/auth.js";
```

- [ ] **Step 5: Run tests + build to verify**

Run: `pnpm --filter @mingle/client-core test && pnpm --filter @mingle/client-core build`
Expected: all tests PASS; `dist/index.js` and `dist/index.d.ts` regenerate without TS errors.

- [ ] **Step 6: Commit**

```bash
git add packages/client-core/src/api/auth.ts packages/client-core/src/index.ts packages/client-core/src/__tests__/auth-api.test.ts
git commit -m "feat(client-core): add auth API and public barrel exports"
```

---

## Task 7: Scaffold the Expo app (`apps/mobile`)

**Files:**
- Create: `apps/mobile/` (via Expo template, then trimmed)
- Modify: `apps/mobile/package.json` (name, add workspace dep)
- Create: `apps/mobile/metro.config.js`
- Create: `apps/mobile/.env.example`

**Interfaces:**
- Consumes: `@mingle/client-core` (workspace).
- Produces: a buildable Expo Router app named `@mingle/mobile` that starts in a simulator and shows the default route.

- [ ] **Step 1: Create the Expo app with the Expo Router (TypeScript) template**

Run:
```bash
cd apps && pnpm create expo-app@latest mobile --template tabs --no-install && cd ..
```
Expected: `apps/mobile` is created with an `app/` directory and TypeScript config. (If the interactive prompt blocks, use `--yes`.)

- [ ] **Step 2: Set the package name and add the workspace dependency** — edit `apps/mobile/package.json`

Set `"name": "@mingle/mobile"` and add to `dependencies`:
```json
"@mingle/client-core": "workspace:*"
```

- [ ] **Step 3: Add a pnpm-monorepo-aware Metro config** — `apps/mobile/metro.config.js`

```js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so workspace packages hot-reload.
config.watchFolders = [monorepoRoot];

// Resolve modules from the app first, then the monorepo root (pnpm hoists here).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// pnpm uses symlinks; ensure Metro follows them.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

- [ ] **Step 4: Create `apps/mobile/.env.example`**

```
# Use your machine's LAN IP when testing on a physical device, e.g. http://192.168.0.10:3000
# Use http://localhost:3000 for the iOS simulator; http://10.0.2.2:3000 for the Android emulator.
EXPO_PUBLIC_API_URL=http://localhost:3000
```

- [ ] **Step 5: Install dependencies and the SecureStore module**

Run:
```bash
pnpm install
pnpm --filter @mingle/mobile exec expo install expo-secure-store
```
Expected: `expo-secure-store` is added to `apps/mobile/package.json` with an Expo-compatible version.

- [ ] **Step 6: Verify the app type-checks**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit`
Expected: no errors (the template is type-clean).

- [ ] **Step 7: Verify the app boots (manual)**

Run: `pnpm --filter @mingle/mobile exec expo start`
Expected: Metro starts and prints a QR code. Press `i` (iOS simulator) or `a` (Android emulator); the default tabs screen renders. Stop the server with Ctrl-C.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "chore(mobile): scaffold Expo Router app wired into the workspace"
```

---

## Task 8: Wire `client-core` into the mobile app

**Files:**
- Create: `apps/mobile/src/lib/secure-storage.ts`
- Create: `apps/mobile/src/lib/client.ts`

**Interfaces:**
- Consumes: `createAuthStore`, `configureClient`, `setTokenAccessor`, `KeyValueStorage` from `@mingle/client-core`; `expo-secure-store`.
- Produces:
  - `secureStorage: KeyValueStorage` (backed by expo-secure-store).
  - `useAuthStore` — the app's singleton auth store (Zustand bound hook) created with `secureStorage`.
  - Side effect on import of `client.ts`: configures `client-core` (`baseUrl` from `EXPO_PUBLIC_API_URL`, `onUnauthorized` → logout) and wires the token accessor.

- [ ] **Step 1: Create the SecureStore adapter** — `apps/mobile/src/lib/secure-storage.ts`

```ts
import * as SecureStore from "expo-secure-store";
import type { KeyValueStorage } from "@mingle/client-core";

export const secureStorage: KeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
```

- [ ] **Step 2: Create the client wiring** — `apps/mobile/src/lib/client.ts`

```ts
import {
  configureClient,
  createAuthStore,
  setTokenAccessor,
} from "@mingle/client-core";
import { secureStorage } from "./secure-storage";

export const useAuthStore = createAuthStore(secureStorage);

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

configureClient({
  baseUrl,
  onUnauthorized: () => useAuthStore.getState().logout(),
});

setTokenAccessor(() => useAuthStore.getState().token);
```

- [ ] **Step 3: Build client-core so its `dist` types are available to the app**

Run: `pnpm --filter @mingle/client-core build`
Expected: `dist/` is up to date (the app resolves `@mingle/client-core` from `dist`).

- [ ] **Step 4: Verify the app still type-checks with the new imports**

First add a temporary import to prove resolution — append to `apps/mobile/app/_layout.tsx` imports:
```ts
import "../src/lib/client";
```
Run: `pnpm --filter @mingle/mobile exec tsc --noEmit`
Expected: no errors; `@mingle/client-core` resolves.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): wire client-core with expo-secure-store auth storage"
```

---

## Task 9: Replace routes with auth-gated login / register / home

**Files:**
- Modify: `apps/mobile/app/_layout.tsx` (root Stack)
- Delete: template tab routes under `apps/mobile/app/(tabs)/`
- Create: `apps/mobile/app/index.tsx`
- Create: `apps/mobile/app/login.tsx`
- Create: `apps/mobile/app/register.tsx`
- Create: `apps/mobile/app/(app)/_layout.tsx`
- Create: `apps/mobile/app/(app)/home.tsx`

**Interfaces:**
- Consumes: `useAuthStore` from `../src/lib/client`; `login`, `register`, `ApiError` from `@mingle/client-core`; `expo-router` (`Stack`, `Link`, `router`, `Redirect`).
- Produces: a working navigation graph — unauthenticated users land on `/login`; on success the token is persisted and the user is redirected to `/(app)/home`; `home` can log out.

- [ ] **Step 1: Remove the template tab routes**

Run: `rm -rf apps/mobile/app/\(tabs\)` (and remove `apps/mobile/app/+not-found.tsx` only if it imports a deleted tab path; otherwise leave it).
Expected: `app/` now contains just `_layout.tsx` (and any non-route files).

- [ ] **Step 2: Replace the root layout** — `apps/mobile/app/_layout.tsx`

```tsx
import { Stack } from "expo-router";
import "../src/lib/client";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTitle: "MingleAI" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: "로그인" }} />
      <Stack.Screen name="register" options={{ title: "회원가입" }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Create the auth-routing entry** — `apps/mobile/app/index.tsx`

```tsx
import { Redirect } from "expo-router";
import { useAuthStore } from "../src/lib/client";

export default function Index() {
  const token = useAuthStore((s) => s.token);
  return <Redirect href={token ? "/(app)/home" : "/login"} />;
}
```

- [ ] **Step 4: Create the login screen** — `apps/mobile/app/login.tsx`

```tsx
import { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { Link, router } from "expo-router";
import { login, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";

export default function Login() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { accessToken } = await login(email.trim(), password);
      setAuth({ token: accessToken });
      router.replace("/(app)/home");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="이메일"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={busy ? "로그인 중..." : "로그인"} onPress={onSubmit} disabled={busy} />
      <Link href="/register" style={styles.link}>
        계정이 없으신가요? 회원가입
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "red" },
  link: { marginTop: 16, color: "#3366ff", textAlign: "center" },
});
```

- [ ] **Step 5: Create the register screen** — `apps/mobile/app/register.tsx`

```tsx
import { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { router } from "expo-router";
import { register, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";

export default function Register() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { accessToken } = await register(email.trim(), password);
      setAuth({ token: accessToken });
      router.replace("/(app)/home");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "회원가입에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="이메일"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={busy ? "가입 중..." : "회원가입"} onPress={onSubmit} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "red" },
});
```

- [ ] **Step 6: Create the protected group layout** — `apps/mobile/app/(app)/_layout.tsx`

```tsx
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/lib/client";

export default function AppLayout() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerTitle: "MingleAI" }} />;
}
```

- [ ] **Step 7: Create the home screen** — `apps/mobile/app/(app)/home.tsx`

```tsx
import { View, Text, Button, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "../../src/lib/client";

export default function Home() {
  const logout = useAuthStore((s) => s.logout);

  function onLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>로그인 성공 🎉</Text>
      <Text style={styles.subtitle}>토큰이 안전하게 저장되었습니다.</Text>
      <Button title="로그아웃" onPress={onLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: "600" },
  subtitle: { color: "#666" },
});
```

- [ ] **Step 8: Type-check the app**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Manual end-to-end verification on a simulator**

Prep (separate terminals):
```bash
# 1. Backend stack
docker compose up -d
pnpm dev:backend
# 2. Mobile
cp apps/mobile/.env.example apps/mobile/.env   # adjust EXPO_PUBLIC_API_URL for your target (see file comments)
pnpm --filter @mingle/mobile exec expo start
```
Then: launch the iOS simulator (`i`) or Android emulator (`a`).
Expected behavior:
1. App opens on the **로그인** screen.
2. Tap **회원가입**, enter a new email + password, submit → lands on **로그인 성공 🎉** home screen.
3. Fully close and reopen the app (stop/relaunch from the simulator) → it opens directly on **home** (token persisted via SecureStore).
4. Tap **로그아웃** → returns to **로그인**; relaunch → opens on **로그인** (token cleared).
5. Enter wrong credentials on **로그인** → an inline error message appears, no crash.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/app
git commit -m "feat(mobile): auth-gated login/register/home flow against backend"
```

---

## Task 10: Wire workspace scripts + docs

**Files:**
- Modify: `package.json` (root scripts)
- Modify: `README.md` (mobile dev section)

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm dev:mobile` convenience script and documented mobile setup. `pnpm -r build` and `pnpm -r test` include `client-core`.

- [ ] **Step 1: Add root scripts** — edit `package.json` `scripts`

Add:
```json
"dev:mobile": "pnpm --filter @mingle/mobile exec expo start",
"test": "pnpm -r test"
```

- [ ] **Step 2: Verify monorepo build + tests pass top-to-bottom**

Run: `pnpm -r build && pnpm --filter @mingle/client-core test`
Expected: all packages build; client-core tests PASS. (Backend/web builds unchanged.)

- [ ] **Step 3: Add a "Mobile (Expo)" section to `README.md`**

Append under the existing run instructions:
```markdown
### 모바일 앱 (Expo)

```bash
# client-core 빌드 (최초 1회 / 변경 시)
pnpm --filter @mingle/client-core build

# 환경 변수 (디바이스/시뮬레이터에 맞게 EXPO_PUBLIC_API_URL 수정)
cp apps/mobile/.env.example apps/mobile/.env

# 개발 서버
pnpm dev:mobile   # i = iOS 시뮬레이터, a = Android 에뮬레이터
```
```

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "chore: add dev:mobile script and mobile setup docs"
```

---

## Self-Review

**1. Spec coverage (against Phase 0 of `DEVELOPMENT_PLAN.md`):**
- "`client-core` 추출(스토리지/환경 주입 추상화)" → Tasks 2–6 (config/baseUrl injection, KeyValueStorage injection, auth store, apiFetch, auth API). ✅
- "Expo 앱 스캐폴딩" → Tasks 7–9. ✅
- "데이터 모델 v2 마이그레이션, 백엔드 AI/3D 잔재 제거" → **deliberately deferred** to the Phase 1 plan (listed under "Subsequent plans"); this plan keeps backend untouched so it stays independently shippable. ✅ (scope note, not a gap)
- "EAS·CI 설정" → EAS submission belongs to the Phase 5 launch plan; CI is not yet configured in this repo, so it is out of scope here. Noted, not silently dropped.

**2. Placeholder scan:** No "TBD/TODO/handle edge cases" — every code step has complete code; every run step has an expected result. ✅

**3. Type consistency:** `KeyValueStorage` (storage.ts) consumed by `createAuthStore` (Task 4) and `secure-storage.ts` (Task 8) — identical shape. `AuthResponse.accessToken` produced in Task 6, consumed in Task 9 login/register. `useAuthStore` created in Task 8, consumed in Task 9. `configureClient`/`setTokenAccessor`/`getToken`/`getClientConfig` signatures consistent across Tasks 2, 5, 8. `apiFetch(path, options)` consistent in Tasks 5, 6. ✅

**4. Risks flagged for the executor:**
- Metro + pnpm symlinks can still error on first boot; if module resolution fails, confirm `unstable_enableSymlinks` and `nodeModulesPaths` in `metro.config.js` (Task 7 Step 3).
- For a **physical device**, `localhost` will not reach the backend — set `EXPO_PUBLIC_API_URL` to the machine's LAN IP (`.env.example` documents this).
- The Expo template flavor/flags may evolve; if `--template tabs` differs, the only requirement is an Expo Router app with an `app/` dir — adjust Task 9 Step 1 deletions accordingly.
