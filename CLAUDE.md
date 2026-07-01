# CLAUDE.md

MingleAI **v2** — "가벼운 만남" (light/casual meetup) social-matching **mobile app**. pnpm monorepo (Node 18+). Native iOS/Android via **React Native + Expo**. AI is limited to preference analysis + matchmaking recommendation — it does **NOT** converse for users (that was v1). This branch (`worktree-mobile-pivot-plan`) is the v2 go-forward; `main` still holds the abandoned v1 (AI-agent 3D dating sim). Trust `docs/DEVELOPMENT_PLAN.md` (v2) over the v1 README.

## Maintaining this file

**Whenever a change makes this file stale, update it in the same commit** — commands, ports, env vars, modules, conventions, gotchas, or design tokens. This file is loaded into every session's prompt; treat it as code. A stale CLAUDE.md is worse than none.

Writing tips:
- One line per concept; concrete commands/paths over prose. Brevity = lower token cost every session.
- Document only the non-obvious. Don't restate what the code, README, or `--help` already says.
- Verify against source before writing — never from memory.
- Prefer actionable "do X / don't do Y" gotchas over general description.
- Edit and delete lines that no longer hold; don't just append.

## Layout

- `apps/mobile` (`@mingle/mobile`) — ⭐ primary client. Expo SDK 56, Expo Router (file-based `app/`), react-native-reanimated, expo-secure-store (JWT). Planned: `@shopify/react-native-skia` for the 2D top-down ("어몽어스") party view.
- `apps/backend` (`@mingle/backend`) — NestJS 10 REST + Socket.io gateway, Prisma/PostgreSQL. Reused from v1, migrated to the v2 domain.
- `apps/web` (`@mingle/web`) — Next.js 15. **v2 role = Admin dashboard + minimal consumer web only.** The v1 3D party viewer is legacy.
- `packages/client-core` (`@mingle/client-core`) — platform-agnostic data layer (API client, socket, auth store via zustand) shared by web + mobile; platform bits (token storage, env) are injected. Vitest tests. **Build before mobile/web.**
- `packages/shared` (`@mingle/shared`) — shared TS types (ESM). **Must build first.**
- `packages/mcp`, `packages/mingleai-mcp` — v1 MCP servers, **decoupled from the v2 product path** (optional dev tools only).

## Commands (repo root)

- `pnpm install` → `pnpm build` (`-r`; build order: shared → client-core → apps).
- `pnpm dev:mobile` (`expo start`) / `pnpm dev:backend` / `pnpm dev:web`.
- `pnpm test` (`-r`; client-core = Vitest, backend = jest `*.spec.ts`). `pnpm lint` (`-r`; backend needs the wired-in `ESLINT_USE_FLAT_CONFIG=false`).
- Prisma (from `apps/backend`): `pnpm prisma:migrate`, `pnpm prisma:generate`, `pnpm prisma:studio`.

## Design system — doodle B&W (mobile-first) — enforce on ALL new UI

Concept: "hand-drawn black & white sketchbook." Cute-yet-simple comes from wonky hand-drawn lines and bold B&W contrast, **not color**. Single source of truth: `apps/web/design/DESIGN.md`; reference impl `apps/web/design/mobile-wireframes.html` (6 mobile screens + bottom tab bar). ⚠️ Those live **only on branch `worktree-doodle-style-tile` (uncommitted, in web/CSS form)** — not yet ported into `apps/mobile`.

- **Pure black & white — zero chroma.** Ink `#17150F` on paper `#FFFFFF`, + 3 grays (`#45413A`, `#8A857C`, `#D9D5CC`) + fills (`#F1EFE9`, `#E7E4DC`). No hue anywhere; even state (예정/진행/완료) differs by fill, not color.
- **Hierarchy without color**: emphasis = **inverted black block + white text** (max 1–2 per screen); density = **black hachure** (`repeating-linear-gradient(45deg)`); highlight = gray underline block, not a color wash.
- **Doodle surface = 4 techniques, zero image assets / zero new deps**: (1) wonky per-corner `border-radius`; (2) `::before` border run through SVG `feTurbulence`→`feDisplacementMap` (border wobbles, text stays crisp); (3) solid offset shadow, **no blur** (`4px 5px 0 #17150F`); (4) slight rotation (−1.5°~2°).
- **RN caveat**: the above are web CSS/SVG techniques. In Expo, re-implement via `react-native-svg` (same feTurbulence/feDisplacementMap) or pre-rendered SVG border assets. **Do NOT use MUI / React Native Paper / Material** — the v2 plan's older "RN Paper" note is superseded by this system.
- **Type**: Gaegu 700 (display/short copy), Pretendard (body), Shantell Sans (en/numeric accent), Gamja Flower (rare scribble). Don't set long Korean body <14px in a handwriting font.
- **Motifs** `DoodleHeart/Sparkle/Face/Connector/Speech/MatchGauge/Spinner`; motion = drawn-in via `stroke-dashoffset`, "boil" sparingly, always honor `prefers-reduced-motion`.

## Environment / infra gotchas

- **`.npmrc` has `node-linker=hoisted` — REQUIRED** for Expo/Metro under pnpm (Metro can't resolve transitive deps in pnpm's strict `node_modules`). Don't remove it.
- Mobile API base: `apps/mobile/.env` → **`EXPO_PUBLIC_API_URL`** (not `NEXT_PUBLIC_*`). Device rules: iOS sim `localhost`, Android emulator `10.0.2.2`, physical device = LAN IP. **Release builds must use `https://`** (cleartext HTTP is blocked on iOS/Android).
- **Postgres on 5433**, not 5432 (`docker compose up -d` → `postgres:15`). DSN `postgresql://mingle:mingle_dev@localhost:5433/mingle`. Backend `.env` needs `DATABASE_URL`, `JWT_SECRET`; optional `REDIS_URL` (→ in-memory fallback).
- **`prisma migrate dev/reset` is blocked by the auto-mode permission classifier** (AI-run DB mutation) — the user must run it (via `!` prefix or a Bash permission rule).
- Checking backend TS errors: `grep "error TS"` falsely returns 0 because ANSI color codes sit between "error" and "TS". Grep `"Found N error"` or strip ANSI first.
- Backend ports: dev `3000` (env `PORT`), PM2/prod `4000` (`ecosystem.config.js`, pinned `instances: 1` until `@socket.io/redis-adapter` is added). Web `3100`.

## Data model (v2, `apps/backend/prisma/schema.prisma` — 16 models)

- Added: `MatchmakingQueueEntry`, `PartyMessage`, `GameSession`, `Proposal`, `Match`, `DirectMessageRoom`, `DirectMessage`, `Block`. Removed from v1: `Report`, `PartyReservation`, and `Profile.agentPersona/communicationStyle/values`.
- Concurrency: capacity/count-then-create paths use `prisma.$transaction(..., { isolationLevel: "Serializable" })`; handle `P2034` (retry) + `P2002` (conflict); send notifications **outside** the transaction.
- Carry-forward invariants (Phases 2–5): Match creation must **normalize `(profileId1,profileId2)` ordering** (order-sensitive `@@unique`); `date-plan.create` needs a `matchId` existence guard; dashboard `getSummary/getMyParties` has a known **IDOR** (profileId from query, JwtAuthGuard only) for the auth-hardening phase.

## Status (this branch, not merged to main)

- v2 **Phase 0 + Phase 1 implemented**: Expo scaffold + `@mingle/client-core` (secure-store auth, login/register/home/onboarding), and the v2 data model + backend domain pivot (skeleton modules `matchmaking/proposal/match/messenger`). Backend builds green; jest passing. Native on-device E2E still pending (needs a human `pnpm dev:mobile` run with the backend up).

## Conventions

- Prettier: double quotes, `trailingComma: all`, `printWidth: 100`, semicolons.
- TS: `strict`, `module: Node16`; packages are ESM (`"type": "module"`).
- Korean is used freely in commits, comments, UI copy, and planning docs.
- Auth: `JwtAuthGuard` for user routes, `AdminGuard` + `@Roles(...)` for admin; JWT payload `{ sub, email, role }`. Swagger at `/api`.
