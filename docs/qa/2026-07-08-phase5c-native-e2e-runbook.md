# Phase 5c — Native On-Device E2E Runbook (moderation UI)

**Why this is a human-run doc:** native on-device E2E requires an iOS Simulator (full **Xcode**, not CommandLineTools) or an Android emulator/device — neither exists in the agent environment (`iosSimulator: unavailable`, `androidEmulator: unavailable`). The automated proxy that **was** run headlessly: a Metro **native bundle smoke test** (`expo export -p ios/android`) — the whole app + all Phase-5c routes bundle for both native targets with zero module-resolution/route errors. This runbook covers the interactive part a machine here cannot: tapping the ⋯ menu, submitting a report, confirming a block, and checking the backend side effects.

## 0. Prerequisites

- macOS with **full Xcode** (`xcode-select -p` → `…/Xcode.app/…`) + an iOS Simulator, **or** Android Studio + an emulator/USB device.
- Repo checked out on branch `megahuni` (v2). From repo root: `pnpm install`.

## 1. Bring up the backend + DB

```bash
# Postgres (docker, :5433)
docker compose up -d
# Backend (NestJS, :3000) — from the worktree/repo root
pnpm --filter @mingle/backend prisma:migrate            # if the DB is fresh
pnpm --filter @mingle/backend start:dev
# sanity: curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/  → 200/404 (reachable)
```

Confirm the mobile app points at this backend: `apps/mobile` API base (env / `src/lib/client` config) must resolve to the machine's LAN IP:3000 for a physical device, or `http://localhost:3000` for a simulator.

## 2. Launch the app

```bash
pnpm dev:mobile          # or: cd apps/mobile && pnpm exec expo start
# press  i  (iOS simulator)  or  a  (Android emulator)
```

## 3. Seed data to exercise all three peer surfaces

Register/login **two accounts** (call them A = reporter, B = target). Complete onboarding for both. To exercise every ⋯ entry point you need:
- **Chat**: A and B matched (A sends a proposal to B, B accepts → 1:1 room). 
- **Proposals**: B sends A a proposal (so A sees B on the proposals screen, pending).
- **Party**: both A and B in the same matchmaking party (start matching on both with similar preferences).

## 4. Test cases (run as account A unless noted)

| # | Flow | Steps | Expected |
|---|---|---|---|
| 1 | **Report from chat** | Chat with B → header **⋯** → 신고하기 → pick a reason → type details → 신고 제출 | "신고가 접수되었습니다" alert; offers **이 사용자도 차단** / 아니요; either returns to the chat |
| 2 | **Report from party** | Party → B's card **⋯** → 신고하기 → reason → 제출 | Same success; server report row carries `evidencePartyId` (verify in DB, step 6) |
| 3 | **Report from proposals** | Proposals → B's card **⋯** → 신고하기 → reason → 제출 | Same success |
| 4 | **Report validation** | Report screen: leave reason unselected | **신고 제출** disabled until a reason is picked; details counter shows `n/1000`; cannot exceed 1000 chars |
| 5 | **Block from chat** | Chat with B → **⋯** → 차단하기 → confirm | Returns to **채팅 목록**; B's room no longer appears |
| 6 | **Block from party** | Party → B's card **⋯** → 차단하기 → confirm | B's participant card disappears from the party list |
| 7 | **Block from proposals** | Proposals → B's card **⋯** → 차단하기 → confirm | B's proposal removed from the list |
| 8 | **Report → immediate block** | Case 1, then tap **이 사용자도 차단** on the success alert | B is blocked (verify in settings, case 9) |
| 9 | **Settings + block list** | Home → **설정** → see profile summary (name·age, occupation) → **차단 목록 관리** | Blocked users listed (name·age, occupation); empty state "차단한 사용자가 없어요." when none |
| 10 | **Unblock** | Block list → B's **차단 해제** → confirm | Row removed; back in matchmaking/messaging B can reach A again |
| 11 | **Logout** | 설정 → **로그아웃** | Returns to login; re-login works |
| 12 | **B&W check** | Every new screen (report/blocks/settings) + ⋯ menus | No color anywhere except the OS **Alert** native dialog (red destructive text is expected/allowed) |

## 5. Error-path spot checks

- Kill the backend, then submit a report → expect a "신고 실패" alert with a message, and the **신고 제출** button re-enabled (no soft-lock).
- Kill the backend on the block-list screen → expect the error state with a **다시 시도** retry, not a blank screen.

## 6. Backend side-effect verification (psql)

```sql
-- report recorded + riskScore bumped once per (reporter, reported)
SELECT reason, details, evidence_party_id FROM safety_reports ORDER BY created_at DESC LIMIT 5;
SELECT id, risk_score, status FROM profiles WHERE id = '<B profileId>';   -- risk_score += 0.2; status='suspended' at ≥1.0
-- block persisted (bidirectional filter)
SELECT * FROM blocks WHERE blocker_profile_id = '<A>' AND blocked_profile_id = '<B>';
```

## 7. Pass criteria

All 12 UI cases behave as in the table, the two error paths degrade gracefully, and the DB reflects the report rows + riskScore increment + block row. Record results (and screenshots) under `docs/qa/` and note any deviation as a bug.
