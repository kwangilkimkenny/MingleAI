# Phase 6d — 어몽어스 (Among Us) 파티 미니게임 설계

> v2 MingleAI 파티 아이스브레이커. 매칭된 실제 참가자(+AI 봇)가 파티 안에서 즐기는 소셜 추리 게임.
> `main` v1 아님 — `worktree-mobile-pivot-plan` 기준. 기존 Phase 6a(파티 실시간)·6b(2D 공간)·6c(밸런스 게임) 위에 얹는다.

## 배경 / 문제

현재 파티 화면의 "파티 공간"은 **빈 방에서 내 아바타만 탭 이동 + 별도 밸런스 퀴즈**일 뿐, "게임"이 아니다. 사용자 요구: **역할·미션·킬·회의·투표가 있는 진짜로 시작되는 어몽어스 게임**. 미션은 **탭 완료가 아니라 실제 미니게임**이어야 한다.

## 목표 (핵심 MVP)

역할 배정(크루/임포스터) → 크루 미션(미니게임) 수행 & 임포스터 킬 → 시체 신고/긴급 회의 → 토론 타이머 → 투표/추방 → 승패 판정. 실시간 이동은 기존 `party:move` 전송층 재사용. **혼자서도 플레이·검증 가능하도록 AI 봇 플레이어**(소켓에 실제 접속해 걷고·미션하고·투표)를 만든다.

**비목표(후속):** 사보타주/벤트/유령 관전/미션별 미니게임 대량 다양화/맵 벽·방 구조/안티치트/프로덕션 자동 봇 충원. 이동·킬·미션 근접은 **클라이언트 보고 좌표를 서버가 경량 신뢰**(아이스브레이커 수준, 안티치트 범위 밖).

---

## 아키텍처 개요

`GameSession`에 새 `gameType: "among"`으로 얹는다. 파티당 **active 세션 1개**(부분 유니크 인덱스 `game_sessions_party_active_key`) — 밸런스와 상호배타(한 번에 한 게임). **DB가 유일한 권위 상태 저장소**(`GameSession.state` Json), 모든 전이는 **per-party `pg_advisory_xact_lock` 트랜잭션**(밸런스 `GameService` 패턴 그대로). 마이그레이션 불필요.

신규 구성요소:
- 백엔드 `AmongService`(상태기계) + `AmongConfigProvider`(env) — `PartyModule` providers에 추가, `PartyGateway`에 주입.
- `PartyGateway`에 `among:*` 이벤트 핸들러 + **회의 타이머 스윕**(게이트웨이 소유 `setInterval`).
- `@mingle/shared`에 `Among*` 타입(클라 노출 스냅샷). 권위 `AmongState`는 백엔드 전용.
- `@mingle/client-core` `PartySocketHandle`에 among 메서드 + `onAmongState` 핸들러.
- 모바일: 역할공개 오버레이·확장 맵(미션지점/시체/액션버튼)·미니게임 4종·회의/투표 화면·승패 화면.
- `tools/among-bots.mjs` AI 봇 러너(E2E + 인원 충원).

### 권위 상태 vs 개인화 스냅샷

핵심: **역할은 남에게 숨겨야 한다.** 그래서 `game:state`처럼 방 전체에 동일 스냅샷을 broadcast하지 **않고**, 게이트웨이가 **소켓별로 개인화 스냅샷**을 emit한다(presence map `partyId→Map<socketId,profileId>`로 socketId↔profileId 확보 → 각 소켓에 `among.project(state, viewerProfileId)`).

- **권위 `AmongState`**(서버 전용, `GameSession.state`에 저장): 모든 플레이어 역할·미션·시체·회의·투표 원본.
- **`AmongSnapshot`**(클라 수신): 뷰어 자신의 역할만 노출, 남의 역할은 `phase==="ended"` 전까지 가림. 미션 목록은 **내 것만**. 투표는 "누가 투표했는지"(votedProfileIds)만, 대상은 회의 종료 reveal 시 공개(밸런스 게임 "reveal 전 숨김" 패턴 재사용).

### 이동 / 위치

플레이어 위치는 **기존 `party:move`/`party:moved`(ephemeral)** 로만 흐른다 — 스냅샷에 넣지 않는다. 근접 판정이 필요한 액션(킬/미션/신고)은 payload에 행위자 좌표를 실어 보내고, 클라가 **버튼을 근접 시에만 활성화**한다(경량 신뢰). **시체 위치**는 서버가 알 수 없으므로 kill payload의 `{x,y}`를 저장. **미션 지점 위치**는 start 시 서버가 랜덤 생성해 `AmongState.tasks[].{x,y}`에 저장(백엔드는 `Math.random` 사용 가능 — `GameService.shuffle` 선례).

---

## 상태기계 (AmongState)

```
phase: "playing" | "meeting" | "voting" | "ended"
players:  [{ profileId, name, role: "crew"|"impostor", alive, isBot,
             killCooldownUntil: number|null, emergencyUsed: number }]
tasks:    [{ taskId, profileId, kind: TaskKind, x, y, done }]     // 크루당 N개
bodies:   [{ profileId, x, y, reported }]
meeting:  { reason: "report"|"emergency", calledBy, bodyProfileId?,
            discussionEndsAt: number, voteEndsAt: number,
            votes: Record<voterProfileId, targetProfileId|"skip"> } | null
lastEjected: { profileId, role, wasSkip } | null                  // 직전 추방 reveal
result:   { winner: "crew"|"impostor", reason } | null
```

`TaskKind = "wires" | "sequence" | "hold" | "timing"` (미니게임 4종).

### start(partyId, roster: string[]) → 개인화 broadcast
- `roster` = 현재 presence 멤버(소켓 접속자, 봇 포함). `roster.length < AMONG_MIN_PLAYERS`면 `BadRequest("not-enough-players")`.
- active 세션 있으면 `Conflict("already-active")`(밸런스 포함 — 상호배타).
- 임포스터 `AMONG_IMPOSTORS`명 랜덤 선정, 나머지 크루. `players[]` 구성(name은 profile 조회).
- 각 크루에 `AMONG_TASKS_PER_CREW`개 태스크: 랜덤 `{x,y}`(clampToRoom 여백 안) + 랜덤 `kind`.
- `phase="playing"`, `GameSession.create({gameType:"among", status:"active", state})`.

### doTask(partyId, profileId, taskId) → broadcast
- active among 세션 로드(없으면 `no-active-game`). `phase==="playing"` 아니면 `invalid`.
- taskId가 caller 소유 & `!done` 아니면 `invalid`. `done=true`.
- **크루 승리 체크**: 모든 태스크 done → `result={winner:"crew",reason:"tasks"}`, `phase="ended"`, `status="ended"`.

### kill(partyId, profileId, targetProfileId, x, y) → broadcast
- `phase==="playing"`. caller = alive impostor 아니면 `invalid`. cooldown 안 지났으면 `invalid`.
- target = alive & impostor 아님 아니면 `invalid`. `target.alive=false`, `bodies.push({profileId:target, x, y, reported:false})`, caller `killCooldownUntil = now + AMONG_KILL_COOLDOWN_MS`.
- **임포 승리 체크**: aliveImpostors ≥ aliveCrew → `result={winner:"impostor",reason:"kills"}`, ended.

### report(partyId, profileId, bodyProfileId) / emergency(partyId, profileId) → 회의 진입 broadcast
- `phase==="playing"`, caller alive. report는 해당 body가 `!reported`여야. emergency는 `emergencyUsed < AMONG_EMERGENCY_PER_PLAYER`.
- `meeting = { reason, calledBy, bodyProfileId?, discussionEndsAt: now+AMONG_DISCUSSION_MS, voteEndsAt: now+AMONG_DISCUSSION_MS+AMONG_VOTE_MS, votes:{} }`. report면 그 body `reported=true`. `phase="meeting"`.
- (토론→투표 전환은 스윕이 `now≥discussionEndsAt`에서 `phase="voting"`으로. 별도 데이터 변화 없음 — phase만.)

### vote(partyId, profileId, target) → broadcast
- `phase==="voting"`(스윕이 열어둔 상태). caller alive & 미투표. `votes[caller]=target`(`"skip"` 허용).
- **전원 투표 시 즉시 집계**: `players.filter(alive).every(voted)` → resolveMeeting().

### resolveMeeting(state) (vote 즉시 or 스윕 `now≥voteEndsAt`)
- 최다표 대상 계산(스킵 포함). 단독 최다 & 스킵 아님 → 그 플레이어 `alive=false`, `lastEjected={profileId,role,wasSkip:false}`. 동표/스킵최다 → 추방 없음 `lastEjected={...,wasSkip:true}`.
- **승리 체크**(추방 후): aliveImpostors==0 → 크루승("ejected"); aliveImpostors≥aliveCrew → 임포승. 아니면 `phase="playing"`, `meeting=null`, 모든 alive impostor cooldown 리셋(now).

### sweep (게이트웨이 소유 `setInterval`, `AMONG_SWEEP_MS`)
`among.sweepMeetings()`: active among 세션 중 `phase==="meeting" && now≥discussionEndsAt` → `phase="voting"`; `phase==="voting" && now≥voteEndsAt` → `resolveMeeting`. 전이된 partyId[] 반환 → 게이트웨이가 각 파티 개인화 broadcast. 단일 인스턴스 안전(matchmaking sweep과 동일 제약).

### 승리 조건 요약
- 크루승: 모든 미션 done **또는** 임포스터 전원 추방.
- 임포승: 생존 임포 ≥ 생존 크루.

---

## Config (`among.config.ts`, env, 검증 기본값 — matchmaking 패턴)

| env | 기본 | 하한 |
|---|---|---|
| `AMONG_MIN_PLAYERS` | 4 | 2 |
| `AMONG_IMPOSTORS` | 1 | 1 |
| `AMONG_TASKS_PER_CREW` | 3 | 1 |
| `AMONG_KILL_RANGE` | 0.12 | (0,1] float |
| `AMONG_TASK_RANGE` | 0.10 | (0,1] float |
| `AMONG_KILL_COOLDOWN_MS` | 20000 | 1000 |
| `AMONG_DISCUSSION_MS` | 30000 | 3000 |
| `AMONG_VOTE_MS` | 30000 | 3000 |
| `AMONG_EMERGENCY_PER_PLAYER` | 1 | 0 |
| `AMONG_SWEEP_MS` | 1000 | 250 |

`AMONG_IMPOSTORS`는 `min(impostors, floor((players-1)/2))`로 클램프(임포가 크루 이상일 수 없음).

---

## 게이트웨이 이벤트 (PartyGateway 확장)

모두 `authorize(client, partyId)` 선통과(비참가자 `party:error {message:"forbidden"}`). 에러는 `gameErrorMessage` 매핑 재사용(`already-active`/`no-active-game`/`invalid`) + `not-enough-players`.

**in:**
| 이벤트 | body | 호출 |
|---|---|---|
| `among:start` | `{partyId}` | `start(partyId, roster)` (roster=presence 멤버) |
| `among:task` | `{partyId, taskId, x, y}` | `doTask(partyId, me, taskId)` |
| `among:kill` | `{partyId, targetProfileId, x, y}` | `kill(partyId, me, target, x, y)` |
| `among:report` | `{partyId, bodyProfileId}` | `report(partyId, me, bodyProfileId)` |
| `among:emergency` | `{partyId}` | `emergency(partyId, me)` |
| `among:vote` | `{partyId, targetProfileId}` (`"skip"` 허용) | `vote(partyId, me, target)` |
| `among:sync` | `{partyId}` | `current(partyId)` → **호출자에게만** 개인화 emit |
| `among:end` | `{partyId}` | `end(partyId)` (강제 종료/디버그) |

**out:** `among:state {partyId, snapshot: AmongSnapshot|null}` — 전이 시 방의 **각 소켓에 개인화** emit. 이동은 기존 `party:move`/`party:moved` 그대로.

**개인화 broadcast 헬퍼:** `broadcastAmong(partyId, state)` = `presence.get(partyId)` 순회하며 각 `(socketId,viewerId)`에 `among.project(state, viewerId)` emit.

---

## Shared 타입 (`packages/shared/src/types/among.ts`, index에 export)

클라 노출용(권위 `AmongState`는 백엔드 전용):
```ts
export type AmongRole = "crew" | "impostor";
export type AmongPhase = "playing" | "meeting" | "voting" | "ended";
export type AmongTaskKind = "wires" | "sequence" | "hold" | "timing";

export interface AmongTaskView { taskId: string; kind: AmongTaskKind; x: number; y: number; done: boolean; }
export interface AmongPlayerView { profileId: string; name: string; alive: boolean; role: AmongRole | null; } // role: 자신 or ended일 때만
export interface AmongBodyView { profileId: string; x: number; y: number; }
export interface AmongMeetingView {
  reason: "report" | "emergency"; calledBy: string; bodyProfileId?: string;
  phase: "discussion" | "voting"; endsAt: number;              // 현재 국면 마감
  votedProfileIds: string[];                                    // 누가 던졌는지만
  tally?: Record<string, number>;                               // voting 종료 reveal 시
}
export interface AmongResultView { winner: AmongRole; reason: "tasks" | "ejected" | "kills"; }
export interface AmongSnapshot {
  sessionId: string; phase: AmongPhase;
  myRole: AmongRole | null; myProfileId: string;
  players: AmongPlayerView[];
  myTasks: AmongTaskView[];                                     // 크루만 채워짐
  progress: { done: number; total: number };
  bodies: AmongBodyView[];
  killCooldownUntil: number | null;                            // 임포 자신
  meeting: AmongMeetingView | null;
  lastEjected: { profileId: string; role: AmongRole; wasSkip: boolean } | null;
  result: AmongResultView | null;
}
export interface AmongStateEvent { partyId: string; snapshot: AmongSnapshot | null; }
```

---

## Client-core (`PartySocketHandle` 확장)

메서드: `startAmong(partyId)`, `doAmongTask(partyId, taskId, x, y)`, `killAmong(partyId, targetProfileId, x, y)`, `reportAmong(partyId, bodyProfileId)`, `emergencyAmong(partyId)`, `voteAmong(partyId, target)`, `syncAmong(partyId)`, `endAmong(partyId)`.
핸들러: `onAmongState?: (e: AmongStateEvent) => void`(소켓 `among:state` 구독). 기존 밸런스 핸들/이동 그대로.

---

## 모바일 UI (party/[id].tsx, B&W 두들 + 핑크 포인트)

기존 밸런스 게임 카드와 **공존**(둘 다 시작 버튼; among active면 among UI가 화면을 점유). among 스냅샷은 `onAmongState`로 state에 저장, join 후 `syncAmong`.

- **역할 공개 오버레이**: playing 진입 첫 스냅샷에서 `myRole` 노출("당신은 크루메이트/임포스터") 3초.
- **확장 맵**: `PartyRoomCanvas`에 옵션 props 추가(`stations?`, `bodies?`, 하위호환) 또는 `AmongMap` 신규 — 기존 positioning 수학 재사용. 렌더: 다른 플레이어 아바타(presence+move), 내 미션 지점 마커(크루), 시체(X 표시), 내 아바타. 사망 시 회색.
- **컨텍스트 액션 버튼(맵 하단, 근접 계산은 클라 posRef 기준)**: 미션지점 `AMONG_TASK_RANGE` 내(크루·미완료)→"미션 수행"(→미니게임 모달) / 생존 크루 `AMONG_KILL_RANGE` 내(임포·쿨다운off)→"킬" / 시체 근접→"신고" / "긴급회의"(잔여횟수). 상단 **미션 완료 게이지**(progress.done/total).
- **미니게임 4종**(각 `{onComplete}` → 완료 시 `doAmongTask`): ① **선 잇기** 좌우 기호(★●▲■) 짝맞춤 · ② **순서 누르기** 흩어진 1–6 오름차순(오답 리셋) · ③ **길게 눌러 채우기** 홀드 게이지 ~2s · ④ **타이밍 멈춤** 스윕 마커 타겟존 3회. plain RN View, 새 의존성 0.
- **회의/투표 화면**(meeting≠null): 토론 국면=참가자 목록+타이머, voting 국면=플레이어/스킵 탭 투표+타이머, 종료 reveal=추방자·집계.
- **승패 화면**(result): 크루/임포 승 + 다시하기(`endAmong`→`startAmong`).

봇은 UI 없음 — 스냅샷 소비하고 액션만 emit.

---

## AI 봇 플레이어 (`tools/among-bots.mjs`)

`socket.io-client` 직접 사용(백엔드에 이미 의존). 인자: `PARTY_ID`, 봇 수, 각 봇 토큰(사전 등록/큐 or 매칭으로 파티 합류). 동작:
- 각 봇 소켓 연결 → `party:join` → `among:sync` 구독.
- **playing**: 스냅샷의 `myRole`로 분기. 크루봇=미완료 미션지점으로 `party:move` 스텝 이동, `AMONG_TASK_RANGE` 내 진입 시 `among:task`(짧은 딜레이=미니게임 흉내). 임포봇=최근접 생존 크루로 이동, 근접+쿨다운off `among:kill`. 가끔 시체 신고.
- **meeting/voting**: `voting` 되면 봇도 `among:vote`(MVP: 랜덤/스킵; 임포봇은 자기 아닌 대상).
- 사람 1명 + 봇 3명으로 **풀 라운드 성립**.

---

## 테스트 / E2E

1. **백엔드 jest**(`among.service.spec.ts`): 역할배정(임포 수 클램프)·doTask 완료→크루승·kill→임포승·회의 진입·전원투표 즉시집계·추방 reveal·동표 no-eject·cooldown 거부·비참가/비임포 거부·개인화 project(역할 숨김).
2. **client-core vitest**: among 메서드가 올바른 이벤트/페이로드 emit, `onAmongState` 배선.
3. **모바일 vitest**: 미니게임 완료 콜백, 근접 액션 판정 순수함수.
4. **라이브 2-소켓+봇 E2E**(스크립트): 백엔드+Postgres 대상 파티 형성→봇 러너 풀라운드 자동 구동→크루승/임포승 각 시나리오 어서션.
5. **브라우저(Playwright)**: dev 1명 + 봇 3명, 역할공개→미션(미니게임)→킬/신고→회의→투표→승패 UI 스크린샷 검증.

---

## 파일 구조 (신규/수정)

**백엔드**: `party/among.service.ts`(신규)·`party/among.service.spec.ts`(신규)·`party/among.config.ts`(신규)·`party/party.gateway.ts`(among 핸들러+스윕)·`party/party.gateway.spec.ts`·`party/party.module.ts`(providers).
**shared**: `src/types/among.ts`(신규)·`src/index.ts`.
**client-core**: `src/socket/party-socket.ts`(메서드/핸들러)·테스트.
**모바일**: `app/(app)/party/[id].tsx`(among UI 배선)·`src/components/among/*`(신규: `AmongGame.tsx`·`AmongMap.tsx`·`RoleReveal.tsx`·`MeetingScreen.tsx`·`ResultScreen.tsx`·`minigames/{Wires,Sequence,Hold,Timing}.tsx`)·`src/lib/among.ts`(근접 판정 등 순수 lib)·테스트.
**tools**: `tools/among-bots.mjs`(신규).
**문서**: `CLAUDE.md`(Phase 6d 상태·env·이벤트).

## 열린 결정 (기본값으로 진행, 반대 시 변경)

- 미션 지점은 **랜덤 위치**(맵 시각 다양성). 고정 스테이션 아님.
- 역할은 **종료 시에만** 전원 공개(사망 즉시 공개 안 함). 임포끼리도 MVP에선 서로 모름(기본 임포 1명이라 무의미).
- among과 밸런스는 **상호배타**(active 세션 1개). 파티당 한 번에 한 게임.
- 봇은 **standalone 러너**(프로덕션 자동 충원은 후속).
