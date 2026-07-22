---
name: mega-qa
description: Use when 전수검사/풀퍼널 검증이 필요할 때 — 백엔드·매칭·파티·게임·메신저 로직을 바꾼 뒤, 출시 전, 또는 "가입부터 끝까지 되는지 확인해줘"류 요청. 회귀 검증·QA·funnel test 트리거.
---

# mega-qa — 풀퍼널 라이브 전수검사

## Overview

`tools/mega-qa.mjs` 하나가 설계된 사용자 여정 전체를 실제 백엔드+Postgres 상대로 검사한다:
health → 가입×4(중복 거부) → 온보딩(연령 400 포함) → 매칭 큐(파티 결성, 이중 enqueue 규약) →
파티 소켓(presence·채팅·이동·비참가자 거부) → **어몽어스 "AI를 찾아라"**(4번째 입장 시 **자동 시작** —
하니스는 `among:sync`로 감지해 흡수, 조건 미충족 시에만 명시적 `among:start`로 폴백; 인간 4명 전원
crew·AI 페르소나 2명만 임포스터인 **역할 계약** 검증 → **AI 생동**(서버 스윕이 굴리는 `party:moved`)
→ **긴급회의 2연속**(유저당 1회 제한이라 서로 다른 유저가 소집, 매번 전원이 AI를 지목해 추방) →
**정체 공개**(ended 스냅샷에서만 `isAi:true` 노출)) → 밸런스 게임(비공개 투표→공개, 어몽 세션이
ended여야 충돌 없이 시작됨이라 어몽 다음 순서) → 프로포즈→수락→Match(중복 수락 멱등) →
메신저(REST+소켓+읽음) → 데이트 플랜(select/confirm 역할 분리) → 모더레이션(신고·차단) →
대시보드 → **rate limit(마지막)**.
전 섹션 체크, 정상 ~20초, 실패 시 exit 1. (파티 정원 충족 시 어몽 자동 시작(2a446fc)에 맞춰 섹션
순서를 어몽→밸런스로 재배치했다 — 근거는 `tools/mega-qa.mjs` 파일 헤더 ORDERING NOTE 참고.)

## 실행 절차

```bash
# 0) ⛔ 선행 조건: 직전 mega-qa(또는 auth 다량 호출) 실행 후 60초 경과 필수.
#    dev-login 30/min·social 20/min — 하니스가 실행당 dev-login 여러 회 + social 스팸을 소모한다.
#    직전 실행이 1분 안이면: sleep 60
#    ⚠️ 소셜 전용 인증: 백엔드 .env에 DEV_AUTH_ENABLED=true + IDENTITY_DEV_BYPASS=true 필수
#       (하니스는 실 OAuth 불가 — dev-login + 본인인증 bypass로 VerifiedGuard 게이트 통과)
# 1–3) 백엔드가 이미 :3000에서 /health 200이면 전부 스킵
docker compose up -d                          # Postgres :5433 + Redis
pnpm --filter @mingle/shared build            # 백엔드 runtime require 의존
pnpm --filter @mingle/backend start:dev       # :3000 (apps/backend/.env: DATABASE_URL, JWT_SECRET, DEV_AUTH_ENABLED, IDENTITY_DEV_BYPASS)
# 4)
node tools/mega-qa.mjs                        # 기본 대상 http://localhost:3000 (env MEGA_QA_API로 변경)
```

성공 기준: `MEGA-QA: N/N PASS`(전 체크) + exit 0. 각 체크는 `[N] PASS/FAIL — 이름 (상세)` 형식.

## 반드시 알아야 할 규칙

- **60초 간격 규칙이 최다 오탐 원인.** 어기면 가입(dev-login) 단계부터 429 → 해당 계정 의존
  섹션(모더레이션 등)이 연쇄 중단된다. 이때 **체크 총수 자체가 줄어든다**(중단 섹션의 하위 체크
  미등록). 총수가 기대치 미만이면 가장 위의 FAIL이 근본 원인이고 나머지는 전파다.
- **dev-login 404 / identity 503**: 백엔드에 `DEV_AUTH_ENABLED`/`IDENTITY_DEV_BYPASS`가 없으면
  Signup 섹션 첫 체크에서 명시적 에러로 멈춘다 — .env 설정 후 재시작.
- 실행마다 고유 run-id 계정을 새로 만든다 — **계정·프로필 등 데이터는 이전 실행 잔재와 충돌
  없음.** 단 **매칭 큐는 하니스 실행 간에 공유된다** — 이전(특히 중단된) 실행이 남긴 `status="waiting"`
  잔재 엔트리가 이번 실행의 파티에 섞여 들어가거나(presence가 4명을 넘음) 테스트 유저를 서로
  다른 파티로 분산시킬 수 있다(파티 결성 체크가 4명 미만 공유로 나뉨). 둘 다 설계상 정상이며
  하니스가 자동으로 허용/재시도 처리한다 — 아래 표 참고.
- `BUG:` 접두 FAIL만 제품 버그다. 무접두 FAIL은 먼저 환경(60초 규칙/백엔드 다운/Postgres)을 의심.

## 설계상 정상인 동작 (FAIL 아님)

- 4번째 소켓이 `party:join`하는 순간(섹션 5 중) 어몽어스가 **자동 시작**된다 — 하니스가 `among:start`를
  호출하기도 전에 이미 세션이 active일 수 있다(설계상 정상, 2a446fc). 어몽 섹션(6번)은 이를
  `among:sync`로 감지해 "AUTO-START PATH" 체크를 PASS시키고, 조건 미충족(예: 공유 큐 분산으로 4명
  미만 공유)일 때만 "FALLBACK PATH"로 명시적 `among:start`를 호출한다 — 체크 상세 문구에 어느
  경로였는지 남는다. 어몽과 밸런스는 파티당 ACTIVE 세션 하나만 허용(타입 무관)이라 밸런스 섹션(7번)은
  반드시 어몽이 ended된 뒤 실행되도록 순서가 재배치되어 있다 — 순서를 되돌리지 말 것.
- **2026-07-20 게임 규칙**: 인간 4명은 항상 crew, 임포스터는 서버가 굴리는 AI 페르소나 2명뿐
  (`ai-` 접두 합성 profileId, 실제 Profile 아님). 회의당 4명 전원이 그 AI를 지목하면(살아있는
  AI도 서버 스윕이 자동으로 인간 중 무작위/LLM 투표하므로 최대 2표 분산) 인간 4표가 항상 유일
  최다득표라 추방이 보장된다. `isAi` 필드는 `among.service.ts` `project()`가 게임 종료 전엔 아예
  스프레드하지 않는다(인간·AI 불문 부재) — ended 스냅샷에서만 AI 2명에 `isAi:true`가 붙는다.
  `AMONG_EMERGENCY_PER_PLAYER=1`이라 연속 두 회의는 반드시 서로 다른 유저가 소집해야 한다.
- 파티 "ended" 전환은 관리자 전용 → 실사용 퍼널에서 `dashboard.completedParties`는 0.
- `among:kill` 서버측 거리검증 없음 — 근접판정은 클라이언트 신뢰 설계(안티치트 스코프 밖). 어몽
  섹션은 더 이상 kill/report 경로를 타지 않지만(임포스터가 AI 전용이라 인간이 죽일 수 없음), AI
  임포스터가 낮은 확률로 인간을 킬할 수는 있다(킬 쿨다운 45s+회의 후 유예 15s — 테스트 창 안에서
  거의 발생 안 함, 발생해도 회의 로직 자체엔 영향 없음).
- 이중 enqueue: waiting 중엔 멱등 반환, matched 후엔 409.
- 차단된 상대의 프로포즈는 co-participation 가드가 블록 검사보다 먼저 거른다.
- enqueue 동시 요청이 몰려 매칭 스윕 tx와 경합하면(P2034 재시도 예산 소진) 409("대기열이
  혼잡합니다...")가 뜬다 — 하니스가 최대 3회·300ms 간격으로 자동 재시도한다.
- 공유 매칭 큐의 잔재 waiting 엔트리로 테스트 유저가 여러 파티에 분산되면, 하니스는 A와 같은
  파티를 공유하는 유저(≥2명) 서브셋으로 이후 파티 섹션 체크를 계속 진행한다(PASS-with-note).

## 웹 UI 보완 패스 (선택)

하니스는 API/소켓 계층 전수다. UI까지 볼 때: `pnpm dev:mobile` → `w` → Playwright로
`/login`(소셜 버튼 + __DEV__ dev 로그인), 게이트 사다리(동의→권한→본인인증→온보딩), 홈(코랄 CTA·탭바) 육안 확인.
파티 2D 탭 이동은 웹 no-op(네이티브 전용) — 실기기 항목은 `docs/qa/2026-07-14-native-e2e-runbook.md`.

## Common Mistakes

| 증상                                                        | 원인/조치                                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 가입/로그인 체크 429 FAIL (+총수 감소, 후반 섹션 통째 누락) | 60초 규칙 위반 — `sleep 60` 후 재실행                                                                                                                                                                                                        |
| enqueue 409 잦음/한 번 500                                  | 백엔드가 이 커밋(P2034 소진→409 매핑) 이전 버전인지 확인 — 그 이전이면 raw 500이 그대로 샌다. 큐 혼잡으로 인한 409는 하니스가 최대 3회·300ms 간격으로 자동 재시도하므로 그 자체로는 FAIL 사유가 아니다.                                      |
| 파티 멤버에 모르는 유저 섞임/테스트 유저 분산               | 공유 큐 설계 정상(이전 실행 잔재 waiting 엔트리가 파티를 채우거나 쪼갬) — 하니스가 presence를 ⊇ 비교하고, 분산 시 A와 공유하는 서브셋(≥2)으로 자동 대응한다. 계속 반복되면 오래된 `matchmaking_queue_entries`(status="waiting") 잔재를 정리. |
| enqueue 후 파티 미결성 타임아웃                             | 백엔드 env `MIN_PARTY_SIZE` 확인(기본 4 — 하니스는 4계정 가정)                                                                                                                                                                               |
| 소켓 체크 전멸                                              | 백엔드 재시작 직후 소켓 미준비 — 헬스 200 확인 후 재실행                                                                                                                                                                                     |
| `ECONNREFUSED`                                              | 백엔드 다운 또는 `MEGA_QA_API` 오설정                                                                                                                                                                                                        |
| 밸런스 섹션의 `game:start`가 `already-active` FAIL          | 어몽 섹션이 밸런스보다 먼저 끝나 있어야 한다(파티당 ACTIVE 세션은 하나) — 두 섹션 순서를 어몽→밸런스로 되돌렸는지, 어몽 섹션의 마지막 체크("긴급회의 #2 — ... → ended")가 정말 PASS했는지 확인.                                              |
| 어몽 긴급회의 #2가 `invalid`로 FAIL                         | `AMONG_EMERGENCY_PER_PLAYER=1` — 같은 유저가 두 번째 `among:emergency`를 부르면 거부된다. 하니스는 메팅 #1을 `partyTags[0]`, 메팅 #2를 `partyTags[1]`이 부르도록 이미 분리해뒀다 — 다른 원인(예: 첫 회의가 아직 안 끝남)을 의심.             |
