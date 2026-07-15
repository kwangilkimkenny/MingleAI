# 파티 가로형 게임 월드 고도화 — 디자인 스펙

- 날짜: 2026-07-15
- 상태: 승인됨 (브레인스톰 완료)
- 선행: Phase 6a/6b/6d (파티 실시간·2D 공간·어몽어스), 2026-07-15 게임 월드 재구성

## 1. 개요

파티 화면을 **가로(landscape) 고정 2D 게임 월드**로 고도화한다. 좌측 가상 조이스틱으로
캐릭터를 이동하고, 우측 고정 액션패드로 상호작용한다. 맵은 가구·충돌이 있는 "파티장"
공간이며 로비와 어몽어스가 동일 맵을 공유한다. 캐릭터는 이니셜 원형 칩에서 두들 인형
캐릭터로 교체한다.

**소켓 프로토콜(`party:move` 등)·어몽 판정 로직(`RANGE`)·데이터 모델은 변경하지 않는다.**
이동 조작 모델과 렌더링, 그리고 백엔드 태스크 좌표 배치만 바뀐다.

## 2. 확정 요건

| 항목 | 결정 |
|---|---|
| 가로 전환 범위 | 파티 화면 전체 (로비 + 어몽, 진입 시 가로 lock / 이탈 시 세로 복귀) |
| 이동 조작 | 좌하단 고정 가상 조이스틱 **단독** — tap-to-move 제거 |
| 맵 | 가구 배치 + 벽/가구 충돌 있는 파티장. 로비·어몽 공용. 태스크 스테이션은 가구 앵커 |
| 우측 버튼 | 어몽어스식 고정 버튼판: 큰 컨텍스트 "사용" 버튼 + 보조(신고·긴급회의·킬+쿨다운 링) |
| 캐릭터 | 두들 인형(머리+몸통+팔다리 SVG), 걷기 보빙 + 방향 플립, 이름표, 사망 시 유령 |

## 3. 아키텍처

### 3.1 신규/변경 모듈

```
packages/shared/src/party-map.ts          ← 신규. 맵 단일 진실 (클라 렌더 + 백엔드 태스크 배치 공용)
apps/mobile/src/lib/party-space.ts        ← 확장: moveWithCollision, spawnZone 스폰
apps/mobile/src/components/party/
  PartyWorld.tsx                          ← 신규. 로비·어몽 공용 월드 렌더러
  PartyMapArt.tsx                         ← 신규. 가구 두들 SVG (정적, memo)
  DoodleCharacter.tsx                     ← 신규. 두들 인형 캐릭터
  Joystick.tsx                            ← 신규. PanResponder 가상 스틱
  ActionPad.tsx                           ← 신규. 우측 버튼판
apps/mobile/app/(app)/party/[id].tsx      ← 개편: 가로 lock, 속도 적분 rAF 루프, PartyWorld 채택
apps/mobile/src/components/among/AmongGame.tsx ← 개편: AmongMap 제거, PartyWorld + ActionPad 사용
apps/backend/src/party/among.service.ts   ← 태스크 배치: randomInRoom → PARTY_MAP.stations 셔플
```

삭제: `PartyRoomCanvas.tsx`, `among/AmongMap.tsx` (PartyWorld로 통합).

### 3.2 유지되는 것

- 정규화 0..1 좌표계, rAF 애니메이션 루프, `stepToward`(원격 피어 스무딩),
  `shouldEmit` 스로틀(≤10Hz), 클라 주도 위치(서버는 `party:move` 릴레이만).
- 어몽 킬/태스크/신고 범위 판정(`src/lib/among.ts`의 `RANGE`) — 좌표계 동일하므로 무변경.
- 렌더 기술: 플레인 RN View + react-native-svg. Skia·reanimated 게임루프 미채택
  (8인 + 정적 맵 규모에 과잉, 웹 CanvasKit 부담 — 접근안 B/C 기각 사유).

## 4. 맵 데이터 (`@mingle/shared` `party-map.ts`)

```ts
interface FurnitureDef { id: string; kind: FurnitureKind; x: number; y: number; w: number; h: number }
type FurnitureKind = "bar" | "table" | "sofa" | "stage" | "dj" | "plant" | "rug";
interface StationDef { id: string; x: number; y: number; furnitureId: string }

const PARTY_MAP = {
  aspect: 1.9,                    // 월드 가로:세로 비 — 화면에 aspect-fit(레터박스)
  furniture: FurnitureDef[],      // AABB, 정규화 좌표
  stations: StationDef[],         // 태스크 스테이션 앵커 — 가구 인접 "통행 가능" 지점
  spawnZone: { x, y, w, h },      // 가구 없는 중앙 댄스플로어
};
```

- `solid` 여부는 kind로 결정: `rug`·`stage` = 통행 가능 장식, 나머지 = 충돌.
- **aspect 고정**: 현행은 컨테이너 비율에 따라 x/y 스케일이 달라 시각 거리와 `RANGE`
  판정 거리가 불일치했다. 월드를 고정 비율로 aspect-fit하여 해소한다.
- 스테이션 수는 8개 내외 — 스테이션당 복수 플레이어의 태스크 배정 허용(좌표 공유).
- 데이터 무결성 규칙(테스트로 강제): 스테이션은 solid 가구와 겹치지 않는다,
  spawnZone은 solid 가구와 겹치지 않는다, 모든 앵커는 room margin 안쪽이다.

## 5. 이동·충돌 (`party-space.ts`)

- 캐릭터 = 반지름 `CHAR_R ≈ 0.035`(정규화) 원.
- `moveWithCollision(pos, vel, dtMs, map): Vec2` — 순수 함수:
  1. x축 이동 → solid 가구 AABB와 원 겹침 해소(밀어냄)
  2. y축 이동 → 동일 해소
  3. room margin 클램프
  - 축분리 순서 덕에 벽에 비스듬히 밀면 자연스러운 슬라이딩.
- `spawnFor(profileId)`: 기존 해시 유지, 매핑 대상만 spawnZone 내부로 변경.
- 내 캐릭터 = 조이스틱 속도 적분(`pos += vel × MOVE_SPEED × dt`).
  원격 피어 = 기존 target-lerp(`stepToward`) 유지 — 네트워크는 점 좌표로 도착.
- 원격 피어 좌표는 충돌 해소를 적용하지 않는다(발신 측이 이미 충돌 적용 — 이중 적용 시 떨림).

## 6. 조작

### 6.1 조이스틱 (`Joystick.tsx`, 좌하단)

- 고정 베이스 원 + 노브. PanResponder(신규 의존성 없음, 웹 동작).
- 출력 벡터 = 드래그 오프셋 / 최대 반경, 크기 1 클램프, 데드존 0.15, 놓으면 0.
- 속도 = `MOVE_SPEED × |벡터|` (아날로그 — 살짝 밀면 천천히).
- 파티 화면의 `velRef`에 기록 → rAF 루프가 적분. emit은 기존 `shouldEmit` 게이트.
- 비주얼: 두들 워블 원, 반투명 잉크 라인.
- tap-to-move 전면 제거 — 웹 `locationX` 버그(RN Web Pressable) 자연 소멸.
  CLAUDE.md의 "tap-to-move NATIVE 전용" gotcha도 구현 후 삭제.

### 6.2 액션패드 (`ActionPad.tsx`, 우하단)

- **메인 사용 버튼**(큰 원, ≥64px): 근처 대상에 따라 라벨·동작 변신, 대상 없으면 비활성 dim.
  - 로비: 밸런스 스테이션(= `dj` 부스 앞 앵커) → "밸런스 게임"(모달) / 근처 유저 → "프로필"(MemberSheet 오픈). 복수 근접 시 스테이션 우선.
  - 어몽: 근처 내 미완료 태스크 → "미션"(미니게임 모달)만. 밸런스 스테이션·프로필은
    어몽 중 비활성(파티당 ACTIVE GameSession 1개 규칙과 일치).
- **보조 소형 버튼**(어몽 전용):
  - 크루·임포스터 공통: 신고(근처 시체 있을 때만 활성), 긴급회의
  - 임포스터 추가: 킬 — 쿨다운 중 SVG 원호 링 + 남은 초, 사거리 내 대상 있을 때만 활성
- 사망 시: 조이스틱 유지(유령 이동 가능), 액션패드 전체 숨김(현행 actionBar 정책 승계).
- 현행 좌하단 밸런스 칩과 `AVATAR_TAP_RADIUS` 탭 인스펙션 제거 — 사용 버튼으로 통합.

## 7. 캐릭터 (`DoodleCharacter.tsx`)

- SVG 구성: 머리(`DoodleFace` 재사용) + 몸통·팔다리 라인. 전체 ~44px.
- 이동 중: 보빙(sin 기반 translateY) + 진행 방향 따라 scaleX 플립. 정지 시 정적.
- 머리 위 이름표. 나 = "나" + 잉크 반전 강조(현행 색 규칙 승계: 나=ink 배경).
- 어몽: 사망자 = 반투명 유령 변형, 시체 = 누운 캐릭터 + X 눈(이모지 ✕ 대체).
- `Motion.tsx` 등장 모션은 게임 내부 미적용 원칙 유지(CLAUDE.md).

## 8. 화면 방향 (landscape)

- `expo-screen-orientation` 의존성 추가. `app.json` `"orientation": "default"`로 변경.
- 루트 `_layout.tsx`: 앱 시작 시 `lockAsync(PORTRAIT_UP)` — 파티 외 전 화면 세로 유지.
- 파티 화면: mount 시 `lockAsync(LANDSCAPE)`(양방향), unmount 시 `PORTRAIT_UP` 복귀.
- 모든 lock 호출 try/catch — 웹은 미지원이므로 no-op(웹 = 보조 표면).
- 가로 노치 = left/right safe insets — 조이스틱·액션패드·상단바에 반영.

## 9. 백엔드 변경 (`among.service.ts`)

- `randomInRoom()` 삭제. 태스크 좌표 = `PARTY_MAP.stations` 셔플 후 순차 배정
  (스테이션 수보다 태스크가 많으면 순환).
- `@mingle/shared`에서 import — dual-package(ESM+CJS) 빌드라 CJS require 문제없음
  (`preferenceScore` 전례).
- DB 마이그레이션 불필요: 태스크 좌표는 `GameSession.state` JSON 내부.
  배포 시점에 진행 중이던 세션은 구(랜덤) 좌표 유지 — dev 단계라 허용.

## 10. 오버레이 가로 대응

- 상단바: 얇은 바 유지 + 가로 insets.
- 채팅 시트·MemberSheet·밸런스 모달·미니게임 모달: 가로에선 하단 시트 대신
  **중앙 카드(최대 폭 ~480)**로 통일.
- MeetingScreen / ResultScreen / RoleReveal: 전체화면 유지, 가로 배치(2열 등) 조정.
- 가로 키보드가 화면 절반을 차지 — 채팅 입력 시 감수, 실기기 QA 체크 항목.

## 11. 에러 처리

- orientation lock 실패: 무시하고 진행 — 레이아웃은 flex 기반이라 세로에서도 동작.
- 소켓 다운: 기존 배너 유지. 조이스틱 이동은 로컬 계속, 재연결 시 최신 위치 emit(현행 동일).
- 조이스틱 제스처 취소(전화 수신 등): responder terminate 시 벡터 0 리셋.

## 12. 테스트

| 계층 | 내용 |
|---|---|
| mobile vitest | `moveWithCollision`: 벽 슬라이딩, 코너, 고속 관통 방지, margin 클램프. spawnZone 스폰. 조이스틱 벡터 정규화·데드존(순수 로직 분리). |
| shared 테스트 | `PARTY_MAP` 무결성: 스테이션-solid 가구 비겹침, spawnZone 가구 프리, margin 내부. |
| backend jest | 태스크 좌표 ∈ 스테이션 좌표 집합. 기존 among 스위트 그린 유지. |
| 회귀 | `pnpm test` 전체 + tsc + `/mega-qa`(소켓 프로토콜 무변경 — 60/60 그린 기대). |
| 실기기 | 가로 lock/복귀, 노치 insets, 조이스틱 감도, 가로 키보드 — 네이티브 E2E 런북에 추가. |

## 13. 범위 밖 (명시적 제외)

- 멀티룸/복도 맵, 카메라 스크롤 — 단일 룸 유지.
- 서버 측 이동 검증(속도/충돌 치팅 방지) — 위치는 계속 클라 주도.
- tap-to-move 병행 지원.
- Pretendard 번들, 웹 전용 조작 최적화.

## 14. 마무리 시 문서 갱신

- CLAUDE.md: tap-to-move gotcha 삭제, 조이스틱·가로·PARTY_MAP·expo-screen-orientation 반영.
- 네이티브 E2E 런북: 가로/조이스틱 체크리스트 추가.
