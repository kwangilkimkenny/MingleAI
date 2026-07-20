# CLAUDE.md

MingleAI **v2** — "가벼운 만남" (light/casual meetup) social-matching **mobile app**. pnpm monorepo (Node 18+). Native iOS/Android via **React Native + Expo**. AI is limited to preference analysis + matchmaking recommendation — it does **NOT** converse for users (that was v1). **Branch `megahuni` = mainline** (repo 루트에 직접 체크아웃, 2026-07-15~; `main`은 폐기된 v1 아카이브 — v1 README를 믿지 말 것). 상세 스펙: `docs/DEVELOPMENT_PLAN.md`(v2) + `docs/superpowers/plans/*`.

## Maintaining this file

**Whenever a change makes this file stale, update it in the same commit** — commands, ports, env vars, modules, conventions, gotchas, or design tokens. This file is loaded into every session's prompt; treat it as code. A stale CLAUDE.md is worse than none.

Writing tips:
- One line per concept; concrete commands/paths over prose. Brevity = lower token cost every session.
- Document only the non-obvious. Don't restate what the code, README, or `--help` already says.
- Verify against source before writing — never from memory.
- Prefer actionable "do X / don't do Y" gotchas over general description.
- Edit and delete lines that no longer hold; don't just append. 완료 페이즈 상세는 git log/plan 문서로 — 여기엔 살아있는 규칙만.

## Layout

- `apps/mobile` (`@mingle/mobile`) — ⭐ primary client. Expo SDK 56, Expo Router(file-based `app/`), expo-secure-store(JWT), expo-notifications+expo-device(push), expo-image-picker, expo-screen-orientation(파티 화면 가로 lock), lucide-react-native + react-native-svg, reanimated 4, `@expo-google-fonts/gaegu`.
  - **내비**: 비로그인 루트(`app/index.tsx`) → `/register`. 로그인+온보딩 후 = 하단 탭바(`app/(app)/(tabs)/_layout.tsx` — 홈·채팅·프로포즈·알림·설정, 커스텀 `DoodleTabBar`). 상세 화면(matching/blocks/chat/party/date-plan/report)은 `(app)` Stack이 탭 위로 push. **네이티브 헤더 전면 비표시**(루트 포함) — 뒤로가기는 `src/components/BackButton.tsx`, 브랜딩은 `DoodleHero`(라인아트 나무늘보 로고 `assets/images/logo.png`).
  - **href 규칙**: 탭 화면은 그룹 탈락형(`/home`, `/chats`, …), 상세 화면은 `(app)` 유지(`/(app)/party/[id]`, …). typed routes는 `expo start`가 재생성 — desync 시 tsc가 잡음.
  - **파티 화면 = 게임 월드**(`party/[id].tsx`): 어몽 세션 활성/직후엔 `AmongGame` 전체화면, 그 외 로비 모드 — 둘 다 공용 `PartyWorld` 렌더러(+얇은 상단 바). 채팅=`PartyChatOverlay`(FAB→중앙 카드), 멤버시트 진입 = 근처 유저 액션패드 "프로필" 또는 상단 멤버 버튼(Users 아이콘, `MemberSheet` — 프로포즈/⋯모더레이션), 밸런스 게임 진입 = DJ 부스 앞 액션패드 "밸런스 게임"→모달. 어몽 내부는 `src/components/among/*`(missions ARE minigames).
  - ⚠️ **이동 = 좌측 조이스틱**(PanResponder — 웹 포함 동작). 파티 화면은 expo-screen-orientation으로 가로 고정(루트는 세로 lock, app.json `orientation: "default"`). 거리·충돌은 world 계량(x×1.9) — 맵/스테이션 단일 진실은 `@mingle/shared` `PARTY_MAP`(백엔드 태스크 배치 공유).
  - **폰트**: Gaegu는 `app/_layout.tsx` `useFonts`로 로드(로드 전 렌더 게이트). `fonts.display`는 워드마크·타이틀·버튼 라벨용 — **긴 한글 본문은 시스템 산스**(Gaegu 14px 미만 금지). Pretendard 본문 폰트는 아직 미번들(백로그).
  - **RN `<Button>` 금지**(플랫폼 기본 파란색이 팔레트 밖) — 항상 `DoodleButton`.
- `apps/backend` (`@mingle/backend`) — NestJS 10 REST + Socket.io gateways(`PartyGateway`/`MessengerGateway`, 기본 네임스페이스), Prisma/PostgreSQL.
- `apps/web` (`@mingle/web`) — Next.js 15. **v2 역할 = 관리자 대시보드 + 최소 소비자 웹.** v1 3D 뷰어는 레거시.
- `packages/client-core` (`@mingle/client-core`) — 플랫폼 불문 데이터 계층(API·소켓·zustand auth). **mobile/web보다 먼저 빌드.**
- `packages/shared` (`@mingle/shared`) — 공유 타입. **가장 먼저 빌드**(dual-package — 아래 gotcha).
- `packages/mcp`, `packages/mingleai-mcp` — v1 MCP 서버, v2 제품 경로와 분리(선택적 dev 도구).

## Commands (repo root)

- `pnpm install` → `pnpm build` (`-r`; 순서: shared → client-core → apps).
- `pnpm dev:mobile` (`expo start`) / `pnpm dev:backend` / `pnpm dev:web`.
- `pnpm test` (`-r`; client-core=Vitest, backend=jest, mobile=순수 lib 전용 Vitest). `pnpm lint`.
- Prisma (`apps/backend`): `pnpm prisma:migrate`, `pnpm prisma:generate`, `pnpm prisma:studio`.
- **QA 도구**:
  - `node tools/mega-qa.mjs` — 풀퍼널 라이브 전수검사 59체크(~20초, 백엔드 :3000 필요). **재실행 60초 간격**(register/login 10회/분/IP — 어기면 가입부터 429 연쇄). `/mega-qa` 스킬(`.claude/skills/mega-qa/`)이 절차·오탐 triage 문서.
  - `node tools/seed-demo.mjs <email> <pw>` — 데모 데이터 시더+상주 봇 3명(파티·프로포즈·DM·데이트플랜 시드, 밸런스 자동투표·어몽 슬로우플레이). 매칭 큐는 실행 간 공유 — 잔재 waiting 엔트리가 파티에 섞일 수 있음(설계상 정상).
  - `node tools/among-bots.mjs <count> [--start|--passive] [--hunt]` — 어몽 전용 봇(솔로 테스트). 봇은 항상 crew(임포스터=AI 전용, 2026-07-20~) — `--hunt`는 회의에서 봇/인간이 아닌 프로필(=AI)에 투표.

## Design system — doodle line-art + coral points — enforce on ALL new UI

Concept: "hand-drawn sketchbook" — 잉크 라인아트 `#17150F` on WHITE + **코랄 포인트 팔레트**(2026-07-15 교체). 귀여움은 삐뚤한 손선·흑백 대비에서, 강조는 포인트 컬러 1-2곳에서. 원리 문서 `docs/design/DESIGN.md`(§1 색은 역사적 — 헤더 경고 참조), 라이브 토큰 = `apps/mobile/src/lib/theme.ts`.

- **Doodle primitives**: `src/components/Doodle.tsx`(`DoodleButton`/`DoodleCard`/`ShadowBox` — 워블 보더) + `DoodleSvg.tsx`(`WobbleBox`/`MatchGauge(미사용 — 궁합 표시 예약)`/`DoodleFace`/`DoodleChip`/`DashedLine`) + `DoodleTabBar.tsx`(플로팅 탭바; `TAB_BAR_ROW_HEIGHT`+`useTabBarClearance()` — 탭 화면 하단 패딩 필수) + `DoodleHero.tsx` + `Motion.tsx`(`Enter`/`EnterRow`/`EnterHero` — reanimated 등장 모션, `useReducedMotion` 존중; 게임 내부 미적용) + `src/lib/doodle-path.ts`(`wobbleRect`/`hatchSegments`/`mulberry` 시드 지터).
- **파티 게임 월드 컴포넌트**: `src/components/party/`(`PartyWorld` 로비+어몽 공용 렌더러/`PartyMapArt`/`DoodleCharacter`/`Joystick`/`ActionPad`).
- **팔레트**: ink `#17150F` / paper `#FFFFFF` / grays `#8A857C`·`#D9D5CC` / fills `#F1EFE9`·`#E7E4DC` / **grayDark = 웜 토프 `#736357`**. 포인트: **`accent #FF5864`**(primary CTA·활성 탭·안읽음 배지), `accentDeep #E5424E`(눌림, 파생), `accentSoft #FF8276`(소형 하이라이트), `accentFill #FF9F9D`(연한 틴트), `onAccent #FFF`. **화면당 primary 1개** — 나머지는 잉크-온-화이트. 대형 강조는 잉크 반전 블록(홈 히어로).
- **Hierarchy**: primary = 코랄 `DoodleButton variant="primary"`(잉크 보더 유지); secondary = paper+잉크 외곽. 아이콘 = Lucide outline. **UI에 이모지 금지**(2026-07-16 규칙 — 컬러 이모지는 SVG 아이콘으로; ✓·★ 등 모노크롬 기호는 허용). `DoodleButton`은 FLAT(그림자 없음) — 하드 오프셋 잉크 그림자는 카드류만.
- **RN gotchas**:
  - `feTurbulence`/`feDisplacementMap`은 react-native-svg 네이티브 미지원 — 워블은 `doodle-path.ts` 시드 지터 패스.
  - 단면 `borderStyle:"dashed"`는 RN 네이티브에서 깨짐(facebook/react-native#24224) — `DashedLine` 사용.
  - `@react-navigation/*` 직접 의존 아님 — 타입은 `expo-router/js-tabs`(BottomTabBarProps)·`expo-router/react-navigation`(useHeaderHeight)에서.
  - RN Web `Switch`는 `trackColor` 객체 무시(기본 그린) — `Platform.OS==="web"`일 때 `activeTrackColor` 스프레드로 교정(notifications.tsx 참조).
  - 내비게이터 기본 배경(#F2F2F2) 노출 방지 — 모든 Stack `screenOptions.contentStyle`에 `colors.paper`.
  - MUI/RN Paper/Material 금지.

## Environment / infra gotchas

- **`.npmrc` `node-linker=hoisted` — 필수**(Metro가 pnpm strict node_modules 해석 불가). 제거 금지. **낡은 `.pnpm` 레이아웃 위에 재설치하면 @nestjs/core 이중 실체로 DI 크래시** — 브랜치 전환 후 이상하면 node_modules 전부 삭제 후 재설치.
- `pnpm install`이 bcrypt 네이티브 바인딩을 지울 수 있음(빌드 스크립트 차단) — `cd node_modules/bcrypt && ../.bin/node-pre-gyp install --fallback-to-build`. better-sqlite3는 빌드 제외됨(v1 mcp 전용; CLT 영수증 없는 맥에서 install 차단 방지).
- Mobile API base: `apps/mobile/.env` `EXPO_PUBLIC_API_URL`. iOS sim `localhost`, Android emu `10.0.2.2`, 실기기 = LAN IP. 릴리즈는 `https://` 필수.
- **jest 30이 pretty-format@30을 루트로 호이스트하면 expo metro-runtime 웹 번들이 크래시** — `apps/mobile` devDep `pretty-format@29.7.0` 고정으로 해결(제거 금지).
- **Postgres :5433**(`docker compose up -d`). DSN `postgresql://mingle:mingle_dev@localhost:5433/mingle`. backend `.env`: `DATABASE_URL`, `JWT_SECRET` 필수; `REDIS_URL` 선택(없으면 인메모리).
- **`prisma migrate dev/reset/deploy`는 권한 분류기가 차단** — 사용자가 직접 실행(`!` prefix).
- backend TS 에러 grep: ANSI 색코드 때문에 `error TS`가 0으로 나옴 — `"Found N error"`로.
- 포트: backend dev 3000 / PM2 4000(`instances:1` 고정 — redis-adapter 전까지) / web 3100 / Metro 8081.
- **매칭 env**(선택→검증 기본값): `MIN_PARTY_SIZE`(4)/`MAX_PARTY_SIZE`(8)/`MATCH_SWEEP_MS`(2500)/`MATCH_MAX_WAIT_MS`(120000)/`MATCH_BASE_THRESHOLD`(0.5). 스윕은 lifecycle `setInterval` — 단일 인스턴스 전용.
- **어몽 = "AI를 찾아라"(2026-07-20 변형)**: 인간은 **전원 crew** — 임포스터는 **AI 페르소나 전용**(`AMONG_AI_COUNT`명, `ai-` 접두 profileId, 인간 임포스터 선출 로직 제거). AI는 LLM으로 채팅·투표·이동·킬(`AiImpostorBrain`, PartyGateway 1s 스윕에 편입) — `LLM_API_URL` 미설정 시 `AMONG_AI_REQUIRE_LLM=false`여야 시작 가능(그 외엔 템플릿 대사 폴백). `AMONG_AUTO_MEETING_MS` 경과 시 주기 자동 회의 소집(`reason:"auto"`). `isAi`는 ended 스냅샷에만 노출(`isBot`은 어떤 스냅샷에도 미노출 — 서버 내부 전용).
- **어몽 env**(`party/among.config.ts` 검증 기본값): `AMONG_MIN_PLAYERS`(4)/`AMONG_TASKS_PER_CREW`(3)/`AMONG_KILL_RANGE`(0.12)/`AMONG_TASK_RANGE`(0.10)/`AMONG_KILL_COOLDOWN_MS`(20000)/`AMONG_DISCUSSION_MS`(30000)/`AMONG_VOTE_MS`(30000)/`AMONG_EMERGENCY_PER_PLAYER`(1)/`AMONG_SWEEP_MS`(1000)/`AMONG_AI_COUNT`(2)/`AMONG_AUTO_MEETING_MS`(120000)/`AMONG_AI_REQUIRE_LLM`(true)/`AMONG_AI_LLM_MAX_CALLS`(60)/`AMONG_AI_CHAT_MIN_MS`(60000)/`AMONG_AI_CHAT_MAX_MS`(90000). 스윕(PartyGateway lifecycle `setInterval`, 단일 인스턴스 전용)이 회의 타이머·주기 자동 회의·AI 봇 틱(이동/킬/투표/채팅)을 전부 처리.
- **게이트웨이 인메모리 상태**: `PartyGateway`의 `humanPos`(플레이어 좌표 맵)·`chatBuf`(파티별 최근 채팅 링버퍼, AI 발화 컨텍스트용)는 프로세스 메모리 — 단일 인스턴스 전용(redis-adapter 전까지 재시작 시 유실).
- **어몽 자동 시작**: `party:join` 후 프레즌스 로스터==파티 정원 && 이 파티에 among 세션이 **한 번도 없었으면** 자동 시작(`maybeAutoStartAmong`; 밸런스 종료 시에도 구제 재시도). ended 파티는 자동 재시작 안 함(다시하기=수동 `among:start`). 실패는 삼킴 — advisory lock+partial unique가 최종 방어. **도구 영향**: 4소켓 파티 join 즉시 게임 시작 — `game:start`(밸런스)는 among ended 후에만(파티당 ACTIVE `GameSession` 1개, gameType 무관).
- **어몽 승리 규칙(2026-07-15 변경)**: 태스크 승리는 **생존자 소유 태스크만** 요구(사망자 태스크 제외 — doTask/kill/회의해소 3곳 재검사 + 진행률 게이지 동일 기준). 사망 크루 태스크 포함하던 구버전은 교착 버그.
- **CORS env**: `SOCKET_CORS_ORIGINS`(양 게이트웨이+REST 공용 allowlist). 미설정→모든 origin 반사(dev), production이면 부팅 WARN. 모듈 로드 시 읽힘 — 프로세스 시작 전에 설정.
- **Rate limit env**: `RATE_LIMIT_TTL_MS`(60000)/`RATE_LIMIT_MAX`(120). 전역 `HttpThrottlerGuard`(ws 컨텍스트 bypass). 강화: auth register/login 10/min, reanalyze 5/min, safety/report 10/min; `/health` 제외. 저장 인메모리 — 단일 인스턴스 전제. **enqueue P2034 소진은 409로 매핑**(재시도 5회+백오프).
- 게이트웨이 앱 에러 이벤트는 네임스페이스드: `party:error` / `messenger:error`(socket.io 예약 `error` 아님) — 개명 시 gateway+client-core+spec 동시 수정.
- Phase-4 env: `PROPOSAL_WINDOW_HOURS`(24)/`PROPOSAL_MAX_PER_PARTY`(3)/`MESSAGE_MAX_LEN`(2000).
- **`@mingle/shared` dual-package**: backend(CJS)가 `preferenceScore` 값을 runtime `require` — shared build가 ESM+CJS 동시 산출. shared 먼저 빌드 안 하면 backend 런타임 실패.
- **push**: `expo-server-sdk`는 ESM-only인데 backend는 CJS — `PushService.ensureExpo()`의 lazy `await import()`(톱레벨 import 금지 — 부팅 크래시). 실패 시 no-op 강등. jest는 `src/__mocks__/`+moduleNameMapper로 목. EAS prod push엔 `app.json` `projectId` 필요(`npx eas-cli init` — 사용자 계정, 런북 §3). `EXPO_ACCESS_TOKEN` 선택.
- **업로드**: `POST /uploads/photo`(JwtAuthGuard, multipart `file`, ≤5MB, magic-byte 검증) → `apps/backend/uploads/`(gitignored), `/uploads/` 정적 서빙. prod는 `PUBLIC_BASE_URL`로 호스트 고정. 모바일 업로드 시 **Content-Type 수동 설정 금지**(fetch가 boundary 유도).

## Data model (v2, `apps/backend/prisma/schema.prisma` — 17 models)

- v2 추가: `MatchmakingQueueEntry`, `PartyMessage`, `GameSession`(밸런스+어몽 겸용, DB-as-state), `Proposal`, `Match`, `DirectMessageRoom`, `DirectMessage`, `Block`, `DeviceToken`. v1 제거: `Report`, `PartyReservation`, `Profile.agentPersona` 등.
- 동시성: 용량/카운트 경로는 Serializable tx + `P2034` 재시도 + `P2002` 충돌 처리; 알림은 tx **밖**에서 non-fatal. 게임 상태 전이는 파티별 `pg_advisory_xact_lock` + partial unique(`game_sessions(party_id) WHERE status='active'`, `matchmaking_queue_entries(profile_id) WHERE status='waiting'`).
- 불변식: Match는 `(profileId1,profileId2)` 정렬 정규화 + `upsert` 멱등(try/catch+refetch는 Serializable tx를 abort시킴 — 금지). Block은 양방향(`isBlockedBetween`) — 메신저 send/history/gateway·프로포즈·수락·스윕에서 강제. **피어 프로젝션은 `{profileId,name,age,gender,occupation,photoUrl?,preferenceSummary?}`만**(`toPeer`/`toPublicProfile`) — `userId`/`riskScore`/raw signals 노출 금지.
- DatePlan: 모든 라우트 membership+block 게이트(`memberContext`); `select`=작성자만, `confirm`=상대만(멱등); 응답은 `DatePlanView`(결제 필드 없음).
- 어몽 스냅샷은 per-viewer 리댁션(타인 role은 ended 전까지 null, `isAi`는 ended 전까지 미노출, 내 태스크만, 투표 대상 숨김) — 브로드캐스트는 per-socket personalized.

## Status (요약 — 상세는 git log + docs/superpowers/plans/)

- **현재 상태**: Phases 0–6d + 두들 디자인 이식 + 코랄 팔레트 + 파티=게임 월드 재구성 + "AI를 찾아라" 변형 + 출시 준비(rate limit·연령 게이트·CORS) 전부 origin/megahuni에 푸시. 마지막 풀 그린: backend jest **344/344**, client-core 73/73, mobile tsc+vitest 107/107, **mega-qa 59/59**, 웹/iOS/Android 번들 스모크.
- **완료 페이즈 한 줄 요약**: P0 스캐폴드+client-core · P1 데이터모델 v2 · P2 온보딩+AI 선호분석(LLM env 미설정 시 stub) · P3 매칭 큐+파티 결성 · P4 프로포즈→매칭→DM(첫 게이트웨이) · P5a push · P5b 데이트플랜 합의 · P5c 모더레이션 UI · P6a 파티 실시간 · P6b 2D 공간 · P6c 밸런스(5라운드, 공개 전 비노출 투표) · P6d 어몽어스 실게임 · 2026-07-14 두들 이식(9task SDD) · 2026-07-15 게임 월드 재구성 + /qa·/design-review 패스(매칭 막다른 화면·어몽 교착 수정, 모션 시스템, 탭 타깃 60px) · 2026-07-20 어몽 → "AI를 찾아라" 변형(인간 전원 crew, 임포스터는 LLM 페르소나 AI 전용, 주기 자동 회의).
- **남은 출시 항목**: EAS projectId(사용자 `npx eas-cli init`), **실기기 네이티브 E2E**(`docs/qa/2026-07-14-native-e2e-runbook.md` — 두들 체크리스트 §5 포함), refresh token, 관리자 모더레이션 웹.
- **백로그**(비차단): 어몽 추방 결과 미표시(`lastEjected` 미렌더)·긴급회의 소진 시 오류문구 미흡·종료 게임 결과 재입장 재노출 정책(제품 판단); push DTO `@ApiProperty` 부재·토글 read-back 없음·cold-start tap 미처리·안읽음 탭 배지; DatePlan `completed` 전이 미구현·결제 잔재 컬럼·레거시 웹 DatePlan 폼(v1 필드, broken); reportUser dedup 잔여 TOCTOU; MatchGauge 미사용(궁합 표시 예약); Pretendard 미번들; 온보딩 iOS KAV 부재·입력 accessibilityLabel 부재; AI게임 — 게임 중 presence 이벤트 시 AI 캐릭터 ≤1s 깜빡임·meetingSpokeFor 위생 정리·방치 파티 auto 회의가 빈 방에 LLM 발화 소모(세션 만료 정책과 묶어 처리)·Block에 ai- id 시 P2003 500(존재 검사 1개)·AI 이동 가구 충돌 무시.

## Conventions

- Prettier: double quotes, `trailingComma: all`, `printWidth: 100`, semicolons.
- TS: `strict`, `module: Node16`; packages are ESM (`"type": "module"`).
- Korean is used freely in commits, comments, UI copy, and planning docs.
- Auth: `JwtAuthGuard` for user routes, `AdminGuard` + `@Roles(...)` for admin; JWT payload `{ sub, email, role }`. Swagger at `/api`.
- 프로세스: 페이즈급 작업은 SDD(plan → per-task review → whole-branch opus review), 회귀는 `/mega-qa`.
