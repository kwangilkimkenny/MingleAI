# 블라인드 스피드 데이트 (Blind Speed Date) — 설계

작성일: 2026-07-22
브랜치: `megahuni`
상태: 설계 확정(사용자 승인) → 구현 착수
코드명: 모듈/라우트 `speed-date`, UI 카피 "블라인드 데이트". autoplan 초안 코드명 "블라인드 로테이션".

## 요약

기존 파티(게임 월드)와 **완전히 별개인** 새 매칭 경험. AI가 성향으로 **남 3 + 여 3**을 한 세션으로 묶고, 6명이 1:1 화상 라운드를 돈다. 정체는 3단계에 걸쳐 점진 공개:

1. **DISGUISED**: 음성변조 + 정적 캐릭터 이미지. 별명 + 성별만.
2. **VOICE**: 실음성 + 정적 캐릭터 이미지(얼굴 여전히 가림).
3. **FACE**: 실음성 + 카메라(얼굴 공개).

각 단계는 3분×3회전 라운드로빈(각자 이성 3명을 단계당 1회씩). 전부 끝나면 10초 비공개 상호 선택 → 서로 고른 경우만 Match+DM.

**아바타 = 비디오 연동 아님.** 카메라 발행을 끈 상태에서 화면을 정적 이미지로 대체할 뿐이다.

## 확정된 결정 (2026-07-22 브레인스토밍)

| 결정 | 값 | 근거 |
|---|---|---|
| 미디어 | **LiveKit**(dev=로컬 docker, prod=LiveKit Cloud) | 로컬 dev 무계정, track-level 발행 제어로 마스킹 용이, 향후 server agent 변조 경로 |
| 음성변조 | **단계적(phased)** — 슬라이스엔 미포함 | 최고난도·리스크. 마스킹 구조는 처음부터, 실제 pitch-shift는 Slice 3 |
| 슬롯 채움 | 실유저 only + **dev AI-fill**(`SPEEDDATE_AI_FILL`) | 신규 앱 유동성. 혼자 플로우 테스트 가능 |
| v1 범위 | **Vertical slice** = FACE 스테이지 1개 | 미디어 파이프라인 먼저 증명, 마스킹은 역방향 후속 |
| 결정 방식 | 스피드데이팅 **비공개 상호 선택** | 일방 관심·거절 비노출, 기존 Match/DM 재사용 |
| 화면 방향 | **세로(portrait)** | 셀피 화상은 세로 자연 |
| 데이터 | **전용 SpeedDateSession/Queue 모델, Party 미사용** | 기존 party 매칭(성별무시 4~8인) 격리, 346 테스트 그린 유지 |

## autoplan 초안과의 관계

`docs/superpowers/plans/2026-07-22-blind-video-party.md`(오늘 `/autoplan` CEO 리뷰)는 **풀 스코프·예약형·Agora** 방향의 premise-gated 초안. 본 spec이 **범위(슬라이스)·미디어(LiveKit)·변조(phased)** 결정을 대체한다. autoplan의 **안전/프라이버시/결정 원칙은 전량 유지**:

- 프라이버시 경계 = UI 숨김이 아니라 **송출 권한**. 3단계 전엔 카메라 캡처·발행 금지.
- 회전마다 그 1:1 채널에만 유효한 **단명 서버 발급 토큰**.
- 대화 중 **비공개 임시 선택** + 마지막 10초 **확인/제출**. 타임아웃 = 선택 없음(자동 프로포즈 아님). 상호 선택만 매치. 거절 비노출.
- **19+ 게이트 + 모드 명시 동의**, v1은 hetero 3:3만(논바이너리/기타 조합은 별도 범위).
- 녹화·원본 미디어 서버 저장 없음.
- 서버 권위, 클라 시계는 표시용, 재접속은 이벤트 재생 아닌 **스냅샷 복구**.

리스크 기록: 향후 변조 품질이 하드 요구가 되고 LiveKit server-agent 경로 비용이 크면 **Agora(`setLocalVoicePitch`/`setLocalVoiceFormant`) 재검토**. 슬라이스는 변조 미포함이라 비차단.

## 아키텍처

### 데이터 모델 (신규 2개, Party 미사용)

**`SpeedDateQueueEntry`** — 성별 인지 큐
- `id, profileId(FK), gender, status(waiting|matched|cancelled|timeout), createdAt, matchedSessionId?`
- partial-unique `(profile_id) WHERE status='waiting'` — 손수 작성 마이그레이션(matchmaking 미러: `migrations/.../qa_unique_invariants` 참조)

**`SpeedDateSession`** — 세션 상태머신(DB-as-state)
- `id, status(active|ended), state Json, result Json?, startedAt, endedAt`
- 참가자·별명·아바타·스케줄·rooms·decisions는 **state JSON**에(among-us `AmongState` 패턴과 일치, FK 없음)
- 한 프로필당 동시 1 세션 불변식은 큐 partial-unique + 세션 생성 시 profile당 active 검사로 보장

결과물은 **기존 `Match` + `DirectMessageRoom` 직접 생성**. `Match.proposalId`는 optional이라 Proposal 없이 가능. `MatchService`의 pair 정규화 + upsert 헬퍼 재사용.

### state JSON 형태

```ts
interface SpeedDateState {
  phase: "preflight" | "round" | "intermission" | "decision" | "ended";
  stageIndex: number;      // 0..(stages-1). 슬라이스: 0만(FACE)
  roundIndex: number;      // 0..2
  phaseEndsAt: number;     // epoch ms — 서버 권위
  sequence: number;        // 멱등/재접속용 단조 증가
  males: string[];         // profileId[3]
  females: string[];       // profileId[3]
  nicknames: Record<string, string>;   // profileId → 세션 별명
  avatars: Record<string, string>;     // profileId → avatarId(정적)
  schedule: Array<Array<[string, string]>>; // [round][pair] = [maleId, femaleId]
  choices: Record<string, string[]>;   // 선택자 profileId → 고른 상대[]
  aiFilled: string[];      // ai- 프로필(dev)
  result?: { matches: Array<{ a: string; b: string; matchId: string }> };
}
```

`stages` 구성: `stageOrder` = 슬라이스 `["FACE"]`, 풀 `["DISGUISED","VOICE","FACE"]`. 각 스테이지가 schedule 전체(3회전)를 돈다.

### 라운드로빈 스케줄 (순수함수, `@mingle/shared`)

한쪽 고정·다른쪽 순환 → 모든 교차 조합 정확히 1회. 세션 시작 시 precompute.

```
R0: M0-F0  M1-F1  M2-F2
R1: M0-F1  M1-F2  M2-F0
R2: M0-F2  M1-F0  M2-F1
```

`buildRotationSchedule(males, females): [maleId,femaleId][][]` — 단위테스트(각 남×여 정확히 1회, 각 회전에 3쌍, 중복 없음).

### per-viewer 공개 projection (순수함수, `@mingle/shared`)

among-us `project(state, viewerId)` 패턴. 소켓마다 현재 스테이지 기준 상대 신원 투영:

| 스테이지 | 상대 projection |
|---|---|
| DISGUISED | `{nickname, gender, avatarId, video:false, voiceMod:true}` |
| VOICE | `{nickname, gender, avatarId, video:false, voiceMod:false}` |
| FACE | `{nickname, gender, video:true, voiceMod:false}` |

**실명/실프로필은 상호 매칭 후 DM에서만.** 세션 내내 별명 유지. FACE에선 카메라(얼굴)만 공개, 실명은 매치 성사 시 DM에서. `projectPartner(state, viewerId): PartnerView | null`(현재 라운드에 짝 없으면 null).

### LiveKit 통합

- 백엔드 `livekit-server-sdk`로 참가자·방별 access token(JWT) 발급. 방 이름 결정적: `sd_{sessionId}_s{stageIndex}_r{roundIndex}_p{pairIndex}`. 해당 2명에게만 grant.
- 라운드 진입 시 서버가 페어링 계산 → 토큰 발급 → 소켓 `speeddate:round`로 6소켓 각자에게 {방이름, LiveKit URL, token, partner projection, stage, phaseEndsAt} 전송.
- 모바일이 그 방 접속, 스테이지 규칙대로 발행:
  - DISGUISED/VOICE: **카메라 미캡처·미발행**, 마이크만. 정적 아바타 이미지 렌더.
  - FACE: 카메라 권한 확인 후 카메라+마이크 발행.
- dev: docker-compose에 `livekit` 서비스 추가. env `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`.

### 결정(DECISION) 단계

- 각 라운드 종료 시 클라가 비공개 임시선택 저장 가능(`speeddate:choose` — toggle, 멱등). 마지막 스테이지 마지막 회전 후 `phase:"decision"`, 10초.
- 10초 = 확인/제출 창. 타임아웃 = 현재 저장된 선택 확정(빈 선택 허용, 자동 프로포즈 없음).
- decision 종료 시 서버가 상호 선택쌍 계산 → 각 쌍 `isBlockedBetween` 재확인 → `Match` + `DirectMessageRoom` 생성(멱등 upsert). 결과를 result에 기록, `match_made` 알림(tx 밖). 비상호는 조용히 없음.

### 게이트웨이 / 스윕

- 신규 `SpeedDateGateway`(별도 모듈, PartyGateway에 합치지 않음). 기본 네임스페이스, JWT 핸드셰이크 인증(PartyGateway 미러). 이벤트 `speeddate:*`.
- 이벤트: `speeddate:join`(세션 스냅샷 수신), `speeddate:leave`, `speeddate:choose`(임시선택 toggle), `speeddate:sync`(재접속 스냅샷). 서버→클라: `speeddate:round`, `speeddate:phase`, `speeddate:ended`, `speeddate:error`.
- lifecycle `setInterval(SPEEDDATE_SWEEP_MS)` — 매칭 sweep(성별 3+3 형성) + 세션 phase 전이(phaseEndsAt 경과 시 round→intermission→다음 라운드→…→decision→ended)를 처리. **단일 인스턴스 전용**(기존과 동일 제약).
- per-socket 개인화 브로드캐스트(among-us `broadcastAmong` 패턴): 각 소켓에 자기 projection만.

### 매칭 sweep (성별 인지)

- 기존 party matchmaking과 **별도**. `SpeedDateQueueEntry(waiting)`에서 male/female 분리, 각 그룹 preferenceScore 상위 + block 제외로 3+3 후보. 후보 6인 중 임의 blocked 페어 존재 시 그 조합 skip.
- threshold 감쇠(대기 길수록 완화, base `SPEEDDATE_BASE_THRESHOLD` 0.4) + `SPEEDDATE_MAX_WAIT_MS` 타임아웃 취소. Serializable tx + P2034/P2002 재시도(matchmaking 패턴).
- dev `SPEEDDATE_AI_FILL=true`: 실유저 있으나 3+3 미달 시 `ai-` 프로필로 채워 세션 형성. AI 상대 방은 원격 참가자 없이 아바타/placeholder(+선택적 스크립트). prod 아님.

### 자격 / 안전 게이트

- enqueue 전: 활성 계정, `preferenceSignals` 분석 완료(기존 게이트 재사용), **만 19+**, **모드 명시 동의**(FACE 공개 동의 포함).
- v1: hetero 3:3만. gender ∈ {male, female}만 큐 허용(그 외는 이번 모드 제외 — 안내 문구). 논바이너리/기타 조합은 백로그.
- 중도 이탈: 상대 나가면 "상대가 나갔습니다", 그 방 유휴, 스윕 계속 진행. 재접속은 `speeddate:sync`로 현재 스냅샷 복구.
- 신고/차단: 기존 `SafetyService`·`PeerModerationMenu` 재사용, 블라인드 세션 문맥 추가.
- 카메라 권한 거부: FACE에서 audio-only 강등(또는 진입 차단). 녹화·원본 저장 없음.

### 모바일

- 신규 라우트 `app/(app)/speed-date/[id].tsx` — **세로**(landscape lock 미호출). 홈에 "블라인드 데이트" 진입 버튼.
- deps: `@livekit/react-native` + `@livekit/react-native-webrtc` + config plugin → **EAS dev build 필요**(Expo Go 불가). 카메라/마이크 권한(app.json).
- 화면: 검색중 → preflight(6인 준비/권한) → 라운드(상대 카드: 별명·성별·아바타 또는 영상, 타이머, 스테이지·회전 인디케이터, 임시선택 토글) → intermission("다음 상대 연결 중…") → decision(만난 이성 3명 그리드, 10초 확인) → 결과("매칭! DM 이동" 또는 "이번엔 매칭 없음").
- `connectSpeedDateSocket`(client-core) + `openSpeedDateSocket`(mobile) — party-socket 미러. REST enqueue/cancel/status.
- 두들 디자인(게임 월드 픽셀 아님) — 차분한 두들 통화 화면. 아바타는 세션 배정 정적 이미지(실프로필 무관, 안전).

### Env / config (`SpeedDateConfig`, 검증 기본값)

`SPEEDDATE_ROUND_MS`(180000) · `_INTERMISSION_MS`(10000) · `_DECISION_MS`(10000) · `_PREFLIGHT_MS`(20000) · `_STAGES`(슬라이스 1, 풀 3) · `_GROUP_PER_GENDER`(3) · `_SWEEP_MS`(2500) · `_MAX_WAIT_MS`(120000) · `_BASE_THRESHOLD`(0.4) · `_AI_FILL`(false) + `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`.

## 테스트 전략

- **shared(Vitest)**: `buildRotationSchedule`(교차조합 완전성), `projectPartner`(스테이지별 redaction), stage 진행 순수 헬퍼.
- **backend(jest)**: 성별 매칭(3+3에서만·block 제외·threshold·AI-fill), phase 전이 스윕, decision→상호 Match/DM 생성(멱등·block 재확인), projection redaction, LiveKit 토큰(방·identity·grant 정확), 자격 게이트(19+/동의/성별).
- **mobile(Vitest 순수 lib)**: 클라 상태 리듀서(스냅샷 적용·타이머 표시 계산).
- **수동/E2E**: LiveKit 로컬 docker + AI-fill 혼자 검증. 실기기 E2E 런북 항목(EAS dev build 필요).

## 구현 순서 (build order)

인프라 불필요한 순수 로직부터 TDD, 미디어·네이티브는 뒤로.

1. **shared**: 타입 + `buildRotationSchedule` + `projectPartner` + 스테이지 헬퍼 (+테스트). 먼저 빌드되는 패키지.
2. **DB**: `SpeedDateQueueEntry`/`SpeedDateSession` 모델 + partial-unique 손수 마이그레이션.
3. **backend `SpeedDateModule`**: config → 매칭 sweep(성별 3+3, AI-fill) → 세션 서비스(DB-as-state, phase 머신, decision→Match) → LiveKit 토큰 서비스 → `SpeedDateGateway`(이벤트 + 스윕 + per-viewer). 각 단위 TDD.
4. **client-core**: `connectSpeedDateSocket` + REST + 타입.
5. **mobile**: LiveKit deps + config plugin, 라우트 + 화면, LiveKit 훅, 소켓 래퍼, 홈 버튼, 세로.
6. **AI-fill dev 경로** 마무리 + docker-compose livekit.
7. 테스트 그린 + 문서(CLAUDE.md, .env.example, 런북 항목).

## 범위 밖 / 백로그

- **Slice 2**: VOICE + DISGUISED 스테이지(아바타 마스킹, 스테이지 3단 진행).
- **Slice 3**: 실제 음성변조(LiveKit server agent). 품질 하드 요구 시 Agora 재검토.
- 예약형(scheduled) 런칭·대기자 승계·성비 예측(prod 유동성 운영).
- 논바이너리/다양한 관계·성별 조합 조 편성 일반화.
- 자체 SFU·음성 코덱, 통화 녹화, 실시간 운영자 영상 감시.
- redis-adapter 다중 인스턴스(현재 스윕·인메모리 단일 인스턴스 전제).

## 미해결 / 사용자 확인 사항

- 없음(브레인스토밍에서 핵심 결정 확정). 구현 중 세부(카피·아바타 에셋 세트·정확한 두들 레이아웃)는 기존 디자인 시스템 따라 진행.
