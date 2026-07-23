# 파티 게임(AI 찾기) 비활성화 + 블라인드 데이트 메인 전환

- 날짜: 2026-07-23
- 상태: 구현 완료 (tsc clean, mobile 127/127, 브라우저 E2E 검증)

## 배경 / 결정

파티 게임 월드("AI를 찾아라")는 픽셀 맵 + 캐릭터 구현 부담이 커서 당장 출시하지 않는다.
기능을 **삭제하지 않고 비활성화**한다(되돌릴 수 있게). 블라인드 스피드 데이트를 **메인**
기능으로 승격한다.

사용자 지시: "숨기지 말고 클릭이 안 되도록 해" + "'준비 중' 배지 + 버튼 비활성".
→ 파티 카드는 **보이되 disabled**, 의도를 '준비 중'으로 명시.

## 설계

1. **되돌림 스위치** — `apps/mobile/src/lib/features.ts` 신규.
   `export const FEATURES = { partyGame: false } as const`. 재활성 = `true` 한 줄.

2. **홈 재구성** (`app/(app)/(tabs)/home.tsx`)
   - 블라인드 데이트 → 최상단 **잉크 ShadowBox 히어로**, 버튼 `variant="primary"`(코랄, 활성).
   - 게임 파티 → 아래 `DoodleCard`로 강등. 우상단 `DoodleChip` "준비 중"(tiny).
     버튼 `disabled={!FEATURES.partyGame}` + 라벨 `FEATURES.partyGame ? "매칭 시작" : "곧 만나요"`.
   - `onStartMatching`에 `if (!FEATURES.partyGame) return;` 가드.
   - "만남은 이렇게 이어져요" step 1 "게임에서 먼저 만나기" → "블라인드 데이트로 만나기"(서사 교체).

3. **매칭 라우트 가드** (`app/(app)/matching.tsx`)
   - enqueue effect: `!FEATURES.partyGame`이면 enqueue 스킵(early return).
   - 렌더: `if (!FEATURES.partyGame) return <Redirect href="/home" />;`
     (선언형 — 잔존 딥링크/알림이 죽은 플로우 못 뚫음, /home으로 깔끔 리다이렉트).

4. **죽은 CTA 재연결** — `chats.tsx` / `proposals.tsx` 빈상태 액션.
   `/(app)/matching` "게임 파티 찾기" → `/(app)/speed-date` "블라인드 데이트 시작" + body 문구 갱신.

5. **백엔드 — 무변경.** 클라 enqueue가 없으면 파티가 결성되지 않아 among도 자동시작되지
   않는다. `party`/`among` 코드 + 백엔드 396 테스트는 그대로 green(dormant).

## 검증

- `tsc --noEmit` clean, mobile vitest **127/127**.
- 브라우저 E2E(Playwright, Expo web): 홈 = 블라인드 데이트 상단 primary + 게임 파티
  '준비 중' `[disabled]`; `/matching` 하드 진입 → `/home` 리다이렉트(enqueue 없음).

## 재활성 방법

`FEATURES.partyGame = true` 한 줄. 홈 버튼·매칭 라우트·CTA가 원복(코드 보존됨).
단, 픽셀 맵/캐릭터 품질 이슈는 그대로이므로 재개 전 별도 작업 필요.
