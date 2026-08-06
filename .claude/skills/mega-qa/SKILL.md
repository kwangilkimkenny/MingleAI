---
name: mega-qa
description: Use when 전수검사/풀퍼널 검증이 필요할 때 — 백엔드·스피드데이트·매칭·메신저 로직을 바꾼 뒤, 출시 전, 또는 "가입부터 끝까지 되는지 확인해줘"류 요청. 회귀 검증·QA·funnel test 트리거.
---

# mega-qa — 풀퍼널 라이브 전수검사 (스피드데이트 퍼널)

## Overview

`tools/mega-qa.mjs` 하나가 설계된 사용자 여정 전체를 실제 백엔드+Postgres 상대로 검사한다:
health → 가입×6(남3+여3; 본인인증 dev bypass → 동의, 중복 CI 409·미성년 403·미인증 403) →
온보딩(프로필 + AI 선호 시그널, verified 나이/성별 권위) → 스피드데이트 큐(취소 위생·중복 409) →
sweep 세션 결성(6인 동일 세션) → 세션 소켓 계약(per-viewer 리댁션·choose 에코 프라이버시·동성
선택 거부) → 상호선택 → 세션 자연 종료 → Match+DM → 메신저(REST+소켓+읽음+차단 강제) →
데이트 플랜(select/confirm 역할 분리) → 모더레이션(신고·차단 사이클) → **rate limit(마지막)**.
실패 시 exit 1. 각 체크는 `[N] PASS/FAIL — 이름 (상세)` 형식.

## 실행 절차

```bash
# 0) ⛔ 선행 조건 3가지:
#    a. 직전 mega-qa(또는 auth 다량 호출) 후 60초 경과 — dev-login 30/min·social 20/min.
#    b. 백엔드 .env: DEV_AUTH_ENABLED=true + IDENTITY_DEV_BYPASS=true (실 OAuth 불가 대체)
#    c. SPEEDDATE_AI_FILL 미설정/false — AI 필이 6인 결성 전에 슬롯을 채우면 결성 검증이 왜곡됨.
# ⏱ 총 소요는 백엔드 SPEEDDATE_* env를 따라간다(세션 자연 종료를 기다림). 빠른 실행:
#    SPEEDDATE_STAGES=1 SPEEDDATE_PREFLIGHT_MS=2000 SPEEDDATE_ROUND_MS=5000 \
#    SPEEDDATE_INTERMISSION_MS=1000 SPEEDDATE_DECISION_MS=3000 → 전체 ~60초(라운드 최소 5000ms — config min 미달 값은 기본값으로 폴백됨).
#    기본 prod env(3스테이지×5분)면 세션 완주에 ~47분 — 짧은 env로 돌릴 것.
#    대기 상한: MEGA_QA_SD_MAX_WAIT_MS (기본 10분 — 초과 시 해당 체크 FAIL)
docker compose up -d                          # Postgres :5433 (+ Redis, LiveKit)
pnpm --filter @mingle/shared build            # 백엔드 runtime require 의존
DEV_AUTH_ENABLED=true IDENTITY_DEV_BYPASS=true SPEEDDATE_STAGES=1 \
SPEEDDATE_PREFLIGHT_MS=2000 SPEEDDATE_ROUND_MS=5000 SPEEDDATE_INTERMISSION_MS=1000 \
SPEEDDATE_DECISION_MS=3000 pnpm --filter @mingle/backend start:dev
node tools/mega-qa.mjs                        # env MEGA_QA_API로 대상 변경
```

성공 기준: `MEGA-QA: N/N PASS`(전 체크) + exit 0.

## 반드시 알아야 할 규칙

- **60초 간격 규칙이 최다 오탐 원인.** 어기면 가입(dev-login) 단계부터 429 → 이후 섹션 연쇄
  중단. 체크 총수가 기대치 미만이면 최상단 FAIL이 근본 원인, 나머지는 전파다.
- **dev-login 404 / identity 503**: `DEV_AUTH_ENABLED`/`IDENTITY_DEV_BYPASS` 미설정 — .env 후 재시작.
- **세션 결성 타임아웃(30s)**: AI_FILL이 켜져 있거나, 다른 클라이언트(에뮬레이터 등)가 큐에
  들어와 정원을 가로챈 경우. 하니스가 섹션 4 시작 때 자기 계정의 waiting은 취소하지만 타인
  엔트리는 못 지운다 — 에뮬 세션/봇을 멈추고 재실행.
- **중복 enqueue 409 체크는 5명 시점에 수행**(6번째가 들어가면 결성 sweep이 waiting을 소비해
  타이밍 레이스 — 테스트 순서를 바꾸지 말 것).
- 실행마다 고유 run-id 계정 — 이전 실행 잔재와 데이터 충돌 없음.
- rate limit 섹션이 마지막인 이유: social 스팸이 공유 IP 카운터를 오염시킴 — 순서 변경 금지.
