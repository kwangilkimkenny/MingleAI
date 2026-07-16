# 실기기 네이티브 E2E 런북 (Phase 0–6d + 두들 디자인 통합판)

**사람이 실행해야 하는 이유:** iOS 시뮬레이터(풀 Xcode)/Android 에뮬레이터가 에이전트 환경에 없다. 헤드리스로 이미 검증된 것: 백엔드 jest 282, 라이브 풀퍼널 E2E 57/57, 어몽어스 4-봇 풀게임, iOS/Android 번들 스모크(3127/3559 modules), 웹 export. 이 문서는 기계가 못 하는 부분 — 실기기 터치·키보드·푸시·두들 렌더 품질 — 만 다룬다. (구판: `2026-07-08-phase5c-native-e2e-runbook.md` — 모더레이션 상세 케이스는 그 문서 §4 재사용.)

## 0. 준비물

- macOS + 풀 Xcode(시뮬레이터) 또는 Android Studio 에뮬레이터/USB 실기기. 푸시 테스트는 **물리 기기 필수**(시뮬레이터는 Expo push token 미발급).
- 브랜치 `megahuni`, 저장소 루트에서 `pnpm install`.
- GOTCHA: `pnpm install` 후 backend 부팅이 bcrypt MODULE_NOT_FOUND로 죽으면:
  `cd node_modules/bcrypt && ../.bin/node-pre-gyp install --fallback-to-build`

## 1. 백엔드 + DB 기동

```bash
docker compose up -d                                   # Postgres :5433 + Redis
pnpm --filter @mingle/shared build                     # 백엔드 runtime require 의존
pnpm --filter @mingle/backend prisma:migrate           # DB 신규일 때 (사용자 직접 실행 — AI 분류기 차단 항목)
pnpm --filter @mingle/backend start:dev                # :3000
```

`apps/backend/.env` 필수: `DATABASE_URL=postgresql://mingle:mingle_dev@localhost:5433/mingle`, `JWT_SECRET`. 선택: `SOCKET_CORS_ORIGINS`(프로드), `RATE_LIMIT_TTL_MS`/`RATE_LIMIT_MAX`, `EXPO_ACCESS_TOKEN`.

## 2. 앱 실행

```bash
pnpm dev:mobile        # expo start → i (iOS sim) / a (Android)
```

`apps/mobile/.env`의 `EXPO_PUBLIC_API_URL`: 시뮬레이터 `http://localhost:3000`, Android 에뮬레이터 `http://10.0.2.2:3000`, 물리 기기 = 맥의 LAN IP.

## 3. EAS projectId (프로드 푸시 빌드 전 1회, 사용자 Expo 계정 필요)

```bash
cd .claude/worktrees/mobile-pivot-plan/apps/mobile   # ⚠️ megahuni worktree 기준 (main의 apps/mobile은 v1 빈 껍데기)
npx eas-cli@latest login    # 패키지명은 eas-cli (npx eas는 실행 파일 없음 → 실패)
npx eas-cli@latest init     # app.json extra.eas.projectId 자동 기입
```

기입 후 `app.json` 변경 커밋. dev/Expo-Go는 projectId 없이도 동작 — 프로드(EAS build) 푸시에만 필수.

## 4. 풀퍼널 시나리오 (계정 A/B 2개, 파티는 among-bots로 충원)

| # | 구간 | 확인 |
|---|---|---|
| 1 | 가입 | **만 19세 체크 전 가입하기 비활성** 확인 → 체크 → 가입. 키보드 열림 시 입력칸·버튼 가림 없음(iOS 소형 기기 중점) |
| 2 | 온보딩 | 프로필 작성(만 19 미만 나이 400 확인), 사진 업로드(expo-image-picker 권한 문구 한국어) |
| 3 | 매칭 | 홈 `매칭 시작` → 큐 → B(또는 유사 선호 계정)로 파티 결성 |
| 4 | 파티 2D | **탭해서 이동(네이티브 전용 — 웹은 no-op 정상)**, 상대 아바타 실시간 이동, 채팅 송수신 |
| 5 | 밸런스 게임 | 시작→투표(공개 전 비노출)→공개→5라운드→결과→다시하기 |
| 6 | 어몽어스 | `node tools/among-bots.mjs 3 --start`로 봇 충원 → 역할 공개(비밀 유지), 미션 미니게임 4종 터치, 킬/신고/긴급회의/투표/승리. 알려진 갭: 추방 결과 화면 미표시, 긴급회의 소진 시 오류 문구 미흡(백로그) |
| 7 | 프로포즈→매칭 | 파티 종료 후 A→B 프로포즈, B 수락 → 매칭 → 1:1 채팅(타이핑·읽음) |
| 8 | 푸시(물리 기기) | 설정 푸시 토글 on → B가 DM 전송 → A 백그라운드 푸시 수신 → 탭 시 해당 채팅방 딥링크 |
| 9 | 데이트 플랜 | 채팅 헤더 진입 → 생성→코스 선택(작성자)→확정(상대)→취소 흐름 |
| 10 | 모더레이션 | ⋯ 메뉴(채팅/파티/프로포즈) 신고+차단, 차단 후 상호 차단 동작 — 상세는 구판 런북 §4 |
| 11 | rate limit | 로그인 11회 연속 → 429 확인, `/health`는 계속 200 |

## 5. 두들 디자인 실기기 체크리스트 (최종 리뷰 지정 항목)

1. **WobbleBox 첫 프레임 플래시** — 각 화면 콜드 마운트/리스트 빠른 스크롤 시 보더 없는 흰 프레임 깜빡임 체감 여부.
2. **Android 카드 그림자** — 홈/프로포즈/데이트플랜 카드 나란히: 전부 선명한 잉크 오프셋(블러 회색 그림자 있으면 버그).
3. **플로팅 탭바** — 노치/비노치 기기 모두 마지막 리스트 행이 바에 안 가림, 탭 터치 정확.
4. **인증 키보드** — login/register 키보드 열림 시 하단 링크까지 스크롤 도달; onboarding 하단 입력칸(선호 텍스트) 키보드에 갇히는지(알려진 미보완 — 갇히면 백로그 승격).
5. **DashedLine** — 채팅/알림/프로포즈/설정 점선 구분선이 실기기에서 실제 렌더되는지.
6. **소형 화면 히어로** — SE급에서 DoodleHero(워드마크+얼굴 2개) 과밀 여부.

## 6. 문제 발생 시

- 백엔드 부팅 크래시: `.env` JWT_SECRET 누락 / bcrypt 바인딩(§0) / `prisma generate` 미실행.
- Metro 해석 실패: `.npmrc node-linker=hoisted` 삭제됐는지 확인.
- 결과는 이슈 단위로 `docs/qa/`에 기록 후 다음 세션에 전달.

## §6. 가로 게임 월드 (2026-07-16 추가)

- [ ] 파티 입장 시 가로 전환, 나가면 세로 복귀 (iOS/Android 각각)
- [ ] 노치 쪽 safe inset — 조이스틱/액션패드/상단바 가림 없음 (기기 양방향 회전)
- [ ] 조이스틱: 데드존, 아날로그 속도(살짝/끝까지), 놓으면 정지, 전화 인터럽트 시 정지
- [ ] 가구 충돌: 테이블/바에 막히고 벽 슬라이딩, 스폰이 댄스플로어 안
- [ ] 로비: 유저 옆 → "프로필", DJ 부스 앞 → "밸런스 게임", 그 외 dim
- [ ] 어몽: 태스크 마커 station 위치, 미션/신고/긴급/킬(쿨다운 링) 버튼, 유령 이동
- [ ] 채팅/멤버시트/밸런스/미니게임 = 중앙 카드, 가로 키보드에서 입력 가능
