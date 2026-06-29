# QA Report — MingleAI Phase 0 (client-core + Expo mobile)

- Date: 2026-06-29
- Branch: `worktree-mobile-pivot-plan`
- Tier: Exhaustive (code/test QA — no simulator/browser in environment)
- Scope: `@mingle/client-core` package + `apps/mobile` hand-authored code (auth foundation)

## Method
Browser/device QA was not applicable: client-core is a library, the RN app has no simulator here, and `expo-secure-store` is native-only (Expo web crashes at login). So: (1) ran the full automated gate, (2) ran 3 parallel adversarial static hunters (client-core correctness, mobile correctness, security/integration), (3) triaged, fixed real bugs as atomic commits with TDD, re-verified.

## Quality gate
| Check | Before | After |
|-------|--------|-------|
| client-core unit tests | 16 passed | **21 passed** |
| client-core build (tsc) | clean | clean |
| mobile `tsc --noEmit` | clean | clean |
| working tree | clean | clean (8 fix commits) |

## Findings fixed (8 atomic commits)
| # | Severity | Finding | Commit |
|---|----------|---------|--------|
| 1 | Critical | `apiFetch` threw raw `SyntaxError` (no `status`) on a 2xx response with empty/non-JSON body → broke `instanceof ApiError` upstream | `7828f3c` |
| 2 | Important | auth-store silently swallowed rehydration errors; no `partialize` (functions implicitly serialized) | `eb9b33a` |
| 3 | Important (coverage) | untested: `isAdmin` super_admin, role-preserve on `setAuth`, profileId-null on logout | `9905864` |
| 4 | Critical | SecureStore adapter had no error handling → a rejected `getItemAsync` could hang hydration (blank screen); `setItem`/`removeItem` throw could crash login/logout | `b81fcc9` |
| 5 | Critical | `useAuthHydrated` could trap the user on a blank screen forever if hydration stalled → added 3s safety-net timeout + de-dupe | `8e3ea16` |
| 6 | Important | empty `accessToken` (`""`) → invisible login→home→login redirect loop; now rejected with a clear error | `70445d2` |
| 7 | Important | logout did `router.replace` AND the layout guard redirected (double navigation/stack race) → guard now sole authority | `e161ff1` |
| 8 | Important | generic `app.json` `name`/`slug`/`scheme` "mobile" (deep-link collision) → `mingleai`; documented HTTPS-required-in-prod in `.env.example` | `1cc048c` |

## Deferred (logged, not blocking a pre-user foundation)
- `apiFetch` header merge drops `Headers`/`string[][]` forms (no current caller passes them; fix needs test rewrite).
- `return undefined as T` on 204 (spec-mandated signature).
- `logout()` doesn't await the async persist write (stale token if process killed in a ~100ms window) — pre-prod hardening; ripples into store API.
- persist `version`/`migrate` infra + an HTTPS runtime guard — **Phase 5 (launch)**.
- UX nits: client-side email/password validation, error `<Text>` `numberOfLines` cap, setState-after-unmount (React 18 no-op), baseUrl trailing-slash normalization.
- Backend API integration test — needs a running backend (Postgres/Redis + `prisma generate`), not available in this environment.

## Confirmed correct (security/integration hunter)
Token stored in secure-store and never logged/in-URL; cleared on logout; the 401→onUnauthorized→logout path can't loop and never fires for login/register calls; every `@mingle/client-core` symbol the app imports exists in the barrel with matching signatures; singleton wiring (configure + setTokenAccessor) runs before any request.

## Notes
- The corrupt-JSON rehydration test intentionally triggers `onRehydrateStorage`, which logs one `[mingle-auth] failed to rehydrate` to stderr — expected error-path output, test passes.

## Verdict
**Phase 0 foundation passed exhaustive code/test QA.** 8 real robustness bugs fixed (3 Critical, 5 Important), coverage raised 16→21 tests, builds clean. Remaining items are pre-production hardening (Phase 5) or low-value nits. The only thing this QA could not exercise: the **live on-device login E2E**, which still needs a human run on a simulator/device.
