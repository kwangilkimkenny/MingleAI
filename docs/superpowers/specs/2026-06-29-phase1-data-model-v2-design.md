# Phase 1 설계 — 데이터 모델 v2 + 백엔드 도메인 피벗

> 작성일: 2026-06-29 · 상태: 확정(구현 계획 대기)
> 상위 기획: `docs/DEVELOPMENT_PLAN.md` (v2). 본 문서는 그 §6(데이터 모델)·§4(제거 항목)·§5.3(백엔드 변경)을 **확정 스키마**로 구체화한다.

## 1. 목표
v1(AI 에이전트 대화 시뮬레이션) 잔재를 걷어내고, v2(실유저 기반 매칭→파티→프로포즈→매칭→메신저→식당예약) 도메인에 맞는 **데이터 레이어와 백엔드 골격**을 확정한다. 비즈 로직은 각 기능 페이즈(2~5)에서 채운다.

## 2. 범위 & 경계
**포함**
- Prisma v2 스키마 확정 + **클린 리셋** 마이그레이션 1개(단일 베이스라인)
- 폐기 백엔드 코드 제거(AI 대화/파티 시뮬레이션, AI 매치 리포트, 파티 예약)
- 잔존 모듈을 v2에 맞게 수정해 **백엔드 컴파일·부팅** 유지
- 신규 도메인 **빈 NestJS 스켈레톤**(matchmaking, proposal, match, messenger) 등록
- `@mingle/shared` 타입을 v2로 교체

**제외(다음 페이즈)**
- 매칭/프로포즈/메신저/게임 **비즈 로직**, 실시간 게이트웨이(Phase 2~4)
- 인증 리프레시 토큰(후속 인증 하드닝 단계)
- 모바일 앱 화면(각 기능 페이즈)

**경계 결정 (확정)**
- `apps/web`(구버전 소비자 웹)은 Phase 1에서 **맞추지 않는다**. shared 타입/API 변경으로 web 빌드가 깨질 수 있으나, "웹 최소 유지" 방침에 따라 web은 추후 **Admin 전용 정리** 단계에서 처리한다. Phase 1의 green 대상은 **`@mingle/backend` + `@mingle/shared` + `apps/mobile`/`@mingle/client-core`**.
- `@mingle/mingleai-mcp`는 이미 깨져 있고(사전 이슈) Phase 1 범위 밖.
- **Block**은 별도 모듈을 만들지 않고 `safety` 모듈에 포함한다(신고와 응집).
- 마이그레이션은 클린 리셋 → 개발 DB를 드롭하고 단일 `v2_baseline` 생성.

## 3. Prisma 스키마 v2 (확정)

### 유지 (변경 없음)
`User`, `Notification`, `SystemSettings`, `SafetyReport`, `PartyParticipant`.

### 변경

```prisma
model Profile {
  id                  String   @id @default(uuid())
  userId              String   @unique @map("user_id")
  name                String
  age                 Int
  gender              String
  occupation          String                         // v2: 필수
  partyPreferenceText String   @map("party_preference_text")   // 신규: 자연어 선호
  preferenceSignals   Json?    @map("preference_signals")      // 신규: AI 분석 결과(분석 전 null)
  photoUrl            String?  @map("photo_url")               // 신규(선택)
  interests           Json?                                     // 신규(선택)
  bio                 String?
  location            String?                                   // v2: 선택화
  riskScore           Float    @default(0) @map("risk_score")   // 안전용 유지
  status              String   @default("active")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  user              User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  partyParticipants PartyParticipant[]
  queueEntries      MatchmakingQueueEntry[]
  partyMessages     PartyMessage[]
  proposalsSent     Proposal[]               @relation("ProposalFrom")
  proposalsReceived Proposal[]               @relation("ProposalTo")
  matchesAsFirst    Match[]                  @relation("MatchProfile1")
  matchesAsSecond   Match[]                  @relation("MatchProfile2")
  directMessages    DirectMessage[]
  blocksMade        Block[]                  @relation("Blocker")
  blocksReceived    Block[]                  @relation("Blocked")
  reportsFiled      SafetyReport[]           @relation("Reporter")
  reportsReceived   SafetyReport[]           @relation("Reported")

  @@map("profiles")
}
// 제거된 필드: preferences, values, communicationStyle(communication_style), agentPersona(agent_persona)
// 제거된 관계: reports(Report), reservations(PartyReservation), datePlansAsFirst/Second(DatePlan는 이제 Match로 연결)
```

```prisma
model Party {
  id              String    @id @default(uuid())
  name            String
  status          String    @default("matching")          // matching | active | ended
  maxParticipants Int       @default(8) @map("max_participants")
  location        String?
  startedAt       DateTime? @map("started_at")
  endedAt         DateTime? @map("ended_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  participants PartyParticipant[]
  messages     PartyMessage[]
  games        GameSession[]
  proposals    Proposal[]
  matches      Match[]

  @@index([status])
  @@map("parties")
}
// 제거: scheduledAt, theme, ageMin/ageMax, roundCount, roundDurationMinutes, results, reports, reservations
```

```prisma
model DatePlan {
  id               String   @id @default(uuid())
  matchId          String   @map("match_id")               // v2: Match로 연결(기존 profileId1/2 제거)
  constraints      Json
  courses          Json
  status           String   @default("draft")
  selectedCourseId String?  @map("selected_course_id")
  merchantPayKey   String?  @map("merchant_pay_key")        // 결제 필드 보존(v2 MVP 미사용)
  paymentId        String?  @map("payment_id")
  paymentStatus    String?  @map("payment_status")
  paymentAmount    Int?     @map("payment_amount")
  createdAt        DateTime @default(now()) @map("created_at")

  match Match @relation(fields: [matchId], references: [id], onDelete: Cascade)

  @@index([matchId])
  @@map("date_plans")
}
```

### 신규

```prisma
model MatchmakingQueueEntry {
  id                 String   @id @default(uuid())
  profileId          String   @map("profile_id")
  status             String   @default("waiting")          // waiting | matched | cancelled
  preferenceSnapshot Json     @map("preference_snapshot")  // 큐 진입 시점 선호 신호
  matchedPartyId     String?  @map("matched_party_id")
  enqueuedAt         DateTime @default(now()) @map("enqueued_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([profileId])
  @@map("matchmaking_queue_entries")
}

model PartyMessage {
  id        String   @id @default(uuid())
  partyId   String   @map("party_id")
  profileId String   @map("profile_id")
  content   String
  createdAt DateTime @default(now()) @map("created_at")

  party   Party   @relation(fields: [partyId], references: [id], onDelete: Cascade)
  profile Profile @relation(fields: [profileId], references: [id])

  @@index([partyId, createdAt])
  @@map("party_messages")
}

model GameSession {
  id        String    @id @default(uuid())
  partyId   String    @map("party_id")
  gameType  String    @map("game_type")
  state     Json
  status    String    @default("active")                  // active | ended
  result    Json?
  startedAt DateTime  @default(now()) @map("started_at")
  endedAt   DateTime? @map("ended_at")

  party Party @relation(fields: [partyId], references: [id], onDelete: Cascade)

  @@index([partyId])
  @@map("game_sessions")
}

model Proposal {
  id            String    @id @default(uuid())
  partyId       String    @map("party_id")
  fromProfileId String    @map("from_profile_id")
  toProfileId   String    @map("to_profile_id")
  status        String    @default("pending")             // pending | accepted | declined
  createdAt     DateTime  @default(now()) @map("created_at")
  respondedAt   DateTime? @map("responded_at")

  party Party   @relation(fields: [partyId], references: [id], onDelete: Cascade)
  from  Profile @relation("ProposalFrom", fields: [fromProfileId], references: [id])
  to    Profile @relation("ProposalTo", fields: [toProfileId], references: [id])

  @@unique([partyId, fromProfileId, toProfileId])
  @@index([toProfileId, status])
  @@map("proposals")
}

model Match {
  id         String   @id @default(uuid())
  partyId    String?  @map("party_id")
  proposalId String?  @unique @map("proposal_id")
  profileId1 String   @map("profile_id_1")
  profileId2 String   @map("profile_id_2")
  createdAt  DateTime @default(now()) @map("created_at")

  party     Party?             @relation(fields: [partyId], references: [id])
  profile1  Profile            @relation("MatchProfile1", fields: [profileId1], references: [id])
  profile2  Profile            @relation("MatchProfile2", fields: [profileId2], references: [id])
  room      DirectMessageRoom?
  datePlans DatePlan[]

  @@unique([profileId1, profileId2])
  @@index([profileId1])
  @@index([profileId2])
  @@map("matches")
}

model DirectMessageRoom {
  id        String   @id @default(uuid())
  matchId   String   @unique @map("match_id")
  createdAt DateTime @default(now()) @map("created_at")

  match    Match           @relation(fields: [matchId], references: [id], onDelete: Cascade)
  messages DirectMessage[]

  @@map("direct_message_rooms")
}

model DirectMessage {
  id              String    @id @default(uuid())
  roomId          String    @map("room_id")
  senderProfileId String    @map("sender_profile_id")
  content         String
  readAt          DateTime? @map("read_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  room   DirectMessageRoom @relation(fields: [roomId], references: [id], onDelete: Cascade)
  sender Profile           @relation(fields: [senderProfileId], references: [id])

  @@index([roomId, createdAt])
  @@map("direct_messages")
}

model Block {
  id               String   @id @default(uuid())
  blockerProfileId String   @map("blocker_profile_id")
  blockedProfileId String   @map("blocked_profile_id")
  createdAt        DateTime @default(now()) @map("created_at")

  blocker Profile @relation("Blocker", fields: [blockerProfileId], references: [id])
  blocked Profile @relation("Blocked", fields: [blockedProfileId], references: [id])

  @@unique([blockerProfileId, blockedProfileId])
  @@map("blocks")
}
```

### 제거
- `model Report` (AI 매치 리포트) — 전체 삭제
- `model PartyReservation` (파티 예약) — 즉석 매칭이라 개념 소멸, 전체 삭제

## 4. 백엔드 모듈 변경

### 제거 (파일/디렉터리)
- `src/report/**` (controller/service/module/dto)
- `src/party/party.gateway.ts` (485줄 AI 시뮬레이션) + `party.service.ts`의 AI 실행 로직
- `src/reservation/**` (파티 예약)
- `src/common/dto/communication-style.dto.ts`, `user-preferences.dto.ts`, `user-values.dto.ts` (+ `common/dto/index.ts` 정리)
- 폐기 로직을 검증하던 spec: `src/party/party.service.spec.ts` 등 (갱신/삭제)

### 수정 (컴파일·부팅 유지)
- `src/profile/**`: DTO에서 preferences/values/communicationStyle 제거, `partyPreferenceText` 필수 + `preferenceSignals/photoUrl/interests/bio/location` 선택 반영. 서비스/컨트롤러 v2 필드에 맞춤.
- `src/party/**`: AI 로직 제거 후 **스켈레톤으로 축소** — `party.service`는 단건/목록 조회만 유지(파티 *생성*은 Phase 2 매칭이 담당), `party.controller`는 조회 라우트만, gateway 삭제. v2 `Party` 필드에 맞게 컴파일.
- `src/date-plan/**`: `matchId` 기준으로 변경.
- `src/admin/**`: 리포트 관리 제거, 유저/파티/안전(+차단) 관리 유지.
- `src/dashboard/**`: 제거된 모델(예약/리포트) 참조 정리해 컴파일 유지(스탯 쿼리 최소화).
- `src/safety/**`: `Block` 생성/조회 추가(스켈레톤 수준 OK).
- `src/notification/**`: 유지.
- `src/app.module.ts`: report/reservation 모듈 제거, 신규 스켈레톤 모듈 등록.

### 신규 스켈레톤 (빈 module + service, AppModule 등록, 라우트 없음/최소)
- `src/matchmaking/` , `src/proposal/` , `src/match/` , `src/messenger/`
- 각 `*.module.ts` + `*.service.ts`(주석 TODO)만. 비즈 로직은 해당 기능 페이즈에서.

### `@mingle/shared`
- v1 타입 제거: profile(values/communicationStyle/preferences/agentPersona), party(rounds/results), report 전체, party-sim 관련.
- v2 타입 추가: `Profile`(간소화), `Party`(status matching/active/ended), `MatchmakingQueueEntry`, `Proposal`, `Match`, `DirectMessage(Room)`, `Block`, `PartyMessage`, `GameSession`, `DatePlan`(matchId).
- backend가 shared를 소비하므로 동반 수정. (web/mcp의 shared 의존은 깨질 수 있음 — §2 경계.)

## 5. 마이그레이션
1. `apps/backend/prisma/migrations/*` 삭제(`migration_lock.toml` 제외 또는 함께 재생성).
2. `schema.prisma`를 §3 v2로 교체.
3. 개발 DB 드롭 후 `prisma migrate dev --name v2_baseline` → 단일 베이스라인 생성.
4. `prisma generate`로 클라이언트 재생성.

## 6. 테스트 & 완료 기준
- `prisma validate` 통과, `v2_baseline` 적용 성공.
- `pnpm --filter @mingle/backend build`(nest build) 성공, 앱 부팅(`AppModule` 정상 로드).
- `pnpm --filter @mingle/shared build` 성공.
- 백엔드 기존 테스트: 폐기 로직 spec 제거/갱신 후 **green**. 변경된 서비스(profile DTO 등)에 최소 테스트 추가.
- `apps/mobile`/`@mingle/client-core` **영향 없음**(green 유지).
- 신규 도메인 모듈이 AppModule에 등록되어 컴파일/부팅에 포함.

## 7. 범위 밖 (명시)
매칭/프로포즈/매치/메신저/게임 비즈 로직, 실시간 게이트웨이, 리프레시 토큰, `apps/web` 정합성, `mingleai-mcp` 복구, 결제.

## 8. 다음 단계
본 spec 기반으로 writing-plans → 작업 단위(TDD) 구현 계획 작성 → 서브에이전트 구현/리뷰/QA.
