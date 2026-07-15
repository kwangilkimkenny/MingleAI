# 파티 = 게임 월드 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 파티 화면을 "기능 세로 나열"에서 **단일 게임 월드**로 재구성 — 매칭 인원이 다 모이면 어몽어스가 **자동 시작**되고, 밸런스 게임·채팅·멤버 프로필/프로포즈는 전부 **맵 내부 요소**가 된다 (사용자 지시 2026-07-15).

**Architecture:** 백엔드 `PartyGateway`가 프레즌스 로스터가 파티 정원에 도달하면 어몽어스를 자동 시작(기존 advisory-lock/부분 유니크가 중복 시작 방지). 모바일 `party/[id].tsx`는 전체화면 맵 월드로 재구성: 게임 활성 중엔 AmongGame이 월드, 게임이 없거나 종료 후엔 "로비 모드"(같은 맵에 밸런스 스테이션·아바타 탭 프로필 시트). 채팅은 하단 접이식 오버레이. 기존 멤버 리스트·게임 시작 버튼·외부 채팅 섹션 제거.

**Tech Stack:** 기존 스택 그대로 (NestJS gateway, RN Views 맵, client-core 소켓 핸들). 신규 의존성 0.

## Global Constraints

- 신규 npm 의존성 금지. 색은 `theme.ts` 토큰만 (`accent #FF5864` 포인트 규칙 유지 — 화면당 primary 1개).
- 백엔드 게임 엔진(AmongService/GameService) 로직 불변 — 게이트웨이 auto-start 트리거만 추가.
- 어몽·밸런스 세션은 파티당 동시 1개(기존 제약) — 밸런스 스테이션은 **어몽 비활성(시작 전/종료 후) 로비 모드에서만** 상호작용 가능.
- `among/*` 게임 내부 컴포넌트(AmongMap/RoleReveal/MeetingScreen/ResultScreen/minigames)는 재사용 — 내부 수정 금지(배치만 변경). `PartyRoomCanvas`는 로비 모드 맵으로 재사용.
- 소켓 계약 변경 금지 (이벤트 추가 없음 — auto-start는 기존 `among:state` 브로드캐스트로 클라이언트에 전파된다).
- 각 태스크 종료: backend는 `pnpm --filter @mingle/backend test` + build 클린, mobile은 tsc + vitest + web export 스모크. 커밋 per task.
- 검증 환경: 백엔드 :3000 가동 중, `node tools/seed-demo.mjs`로 봇 3명 상주 가능. mega-qa 재실행 시 60초 규칙.
- Prettier double quotes/trailingComma all/printWidth 100. 워크스페이스 루트 = /Users/namuneulbo/Desktop/MingleAI (branch megahuni).

---

### Task 1: 백엔드 — 정원 충족 시 어몽어스 자동 시작 (TDD)

**Files:**
- Modify: `apps/backend/src/party/party.gateway.ts` (handleJoin 말미)
- Modify: `apps/backend/src/party/among.service.ts` — 수정 금지가 원칙이나, gateway가 필요로 하는 조회가 없으면 **읽기 전용 헬퍼만** 추가 허용 (`hasAnySession(partyId)` 류)
- Test: `apps/backend/src/party/party.gateway.spec.ts` (기존 스펙 파일에 케이스 추가)

**Interfaces:**
- Consumes: `AmongService.start(partyId, profileId)` (기존 — 시작자 인자 시그니처는 소스에서 확인), presence roster map (게이트웨이 내부), `PartyService` 참가자 조회 (기존 메서드 소스 확인).
- Produces: 동작 규칙 — **party:join 처리 후** 아래 전부 참이면 `AmongService.start` 호출 + 기존 `among:state` per-socket 브로드캐스트 경로 재사용:
  1. distinct 프레즌스 로스터 크기 == 파티 참가자 수 (정원 충족)
  2. 이 파티에 among GameSession이 **하나도 없던 경우만** (ended 재입장 시 재시작 금지 — 다시하기는 기존 수동 경로)
  3. 로스터 크기 ≥ AMONG_MIN_PLAYERS
- 실패는 non-fatal: start가 Conflict(이미 활성 — 동시 join 레이스) 등으로 던지면 삼키고 로그만 (advisory lock + partial unique가 최종 방어).

- [ ] **Step 1: 실패하는 스펙 작성** — 기존 party.gateway.spec.ts의 목 패턴을 따라 3케이스: (a) 로스터==정원 & 세션 전무 → start 1회 호출 + 브로드캐스트, (b) 이미 among 세션 존재(ended 포함) → start 미호출, (c) start가 ConflictException 던져도 join 응답은 정상. 실행해 RED 확인.
- [ ] **Step 2: 구현** — handleJoin 말미에 자동 시작 블록. among 세션 존재 여부 조회는 기존 서비스 메서드(`current`/`latestAmong` — 소스 확인) 조합 또는 읽기 헬퍼.
- [ ] **Step 3: GREEN** — 해당 스펙 + 전체 백엔드 suite (`283+` 유지) + build 클린.
- [ ] **Step 4: 라이브 확인** — seed-demo로 새 파티 결성 → 봇 4번째 join 직후 among:state가 자동으로 흐르는지 (스크립트 로그로 role 수신 확인).
- [ ] **Step 5: 커밋** `feat(backend): 파티 정원 충족 시 어몽어스 자동 시작`

---

### Task 2: 모바일 — 파티 화면 게임 월드 재구성

**Files:**
- Rewrite: `apps/mobile/app/(app)/party/[id].tsx` (503줄 — 전면 재배치, 데이터/소켓 로직은 보존)
- Create: `apps/mobile/src/components/PartyChatOverlay.tsx` (접이식 인게임 채팅)
- Create: `apps/mobile/src/components/MemberSheet.tsx` (아바타 탭 프로필 시트)

**Interfaces:**
- Consumes: 기존 party 소켓 핸들(connectPartySocket — join/chat/move/presence/among*/game*), AmongGame/PartyRoomCanvas (재사용, 내부 불변), PeerModerationMenu(기존 ⋯), 프로포즈 API(파티 상세의 기존 sendProposal 로직 이전).
- Produces (화면 구조):
  1. **전체화면 월드**: 어몽 활성(단 한 번이라도 among:state 수신 & phase != "ended") → `AmongGame`이 화면 전체. 그 외(시작 전 잠깐/종료 후) → **로비 모드**: `PartyRoomCanvas` 전체화면.
  2. **상단 얇은 바(오버레이)**: 나가기(BackButton 패턴) + 파티명 + 접속 인원 칩. 어몽 진행 중엔 미션 게이지(기존 AmongGame 내 요소 그대로 두면 중복되지 않게 확인 — AmongGame이 이미 게이지를 가지면 상단 바에는 넣지 않는다).
  3. **채팅 오버레이**: 우하단 말풍선 FAB(💬 + 미확인 dot) → 하단 40% 높이 슬라이드 패널(기존 채팅 리스트+입력 로직 이동). 패널 열림 상태에서도 맵 보임(반투명 paper 배경). 회의/결과 화면이 뜰 땐 FAB 숨김.
  4. **아바타 탭 → MemberSheet**: 로비 모드 맵에서 아바타 탭 시 하단 시트 — 이름·나이·직업·선호 요약 + `프로포즈 보내기`(기존 로직 이동) + ⋯(PeerModerationMenu). ⚠️ RN Web locationX 제약으로 웹에서 아바타 탭이 안 될 수 있음 — PartyRoomCanvas 내부 수정 없이 가능한 범위에서 구현하되, 탭 좌표→아바타 판정이 캔버스 내부 수정을 요구하면 **로비 상단 바에 멤버 아이콘 버튼(👥) → 멤버 시트 목록**으로 대체(동일 정보·동일 액션, 외부 상시 나열 아님).
  5. **밸런스 게임**: 외부 카드 제거. 로비 모드에서 맵 위 오버레이 버튼 "밸런스 게임"(스테이션 칩, 로비에서만 노출) → 기존 게임 카드 UI를 **모달**로. 어몽 활성 중엔 미노출(백엔드 동시 세션 제약).
  6. 삭제: 멤버 세로 리스트, "어몽어스 시작" 버튼(자동 시작), 외부 밸런스 카드, 외부 채팅 섹션, "홈으로" 버튼(상단 나가기로 충분).
- 기존 소켓 구독/핸들러/dedup/rAF 이동 로직은 **이동만** 하고 다시 쓰지 않는다.

- [ ] **Step 1**: 현행 party/[id].tsx 전체 정독 → 로직(소켓/상태/핸들러)과 표현(JSX/스타일) 분리 목록 작성
- [ ] **Step 2**: PartyChatOverlay·MemberSheet 구현 (두들 토큰: WobbleBox 패널, DashedLine 구분)
- [ ] **Step 3**: party/[id].tsx 재구성 (위 1–6)
- [ ] **Step 4**: tsc + vitest + `expo export --platform web` 스모크
- [ ] **Step 5**: 라이브 검증 — seed-demo 봇 파티에서: 4명 모임→자동 시작(버튼 없이 role reveal 등장), 게임 종료→로비 모드 전환→밸런스 모달 5라운드(봇 자동 투표)→채팅 오버레이 송수신→멤버 시트에서 프로포즈 1건 발송. 웹 Playwright로 확인 가능한 범위 + 스크린샷.
- [ ] **Step 6: 커밋** `feat(mobile): 파티 화면 게임 월드 재구성 — 자동 시작·로비 모드·인게임 채팅/밸런스/프로필`

---

### Task 3: 문서·회귀 마감

**Files:**
- Modify: `CLAUDE.md` (파티 화면 구조·auto-start 규칙), `.claude/skills/mega-qa/SKILL.md` (게임 시작이 자동이 된 데 따른 시나리오 문구), `tools/mega-qa.mjs` (among:start 명시 호출이 auto-start와 충돌하면 — 이미 활성 409를 designed로 처리), `tools/seed-demo.mjs` (체크리스트 문구)
- 검증: mega-qa 풀런(60초 규칙) 그린 + 필요한 문구 갱신

- [ ] **Step 1**: mega-qa 실행 — auto-start로 인해 `among:start`가 already-active를 받는 케이스를 designed 동작으로 흡수(하니스가 자동 시작된 세션을 sync로 집어 이어가도록). 그린까지.
- [ ] **Step 2**: 문서 3종 갱신 + seed-demo 체크리스트 문구.
- [ ] **Step 3: 커밋** `docs+fix(tools): 파티 자동 시작 반영 (mega-qa·seed-demo·CLAUDE.md)`
