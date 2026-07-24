# 라인아트 재설계 + 화면 아키타입 시스템 (소프트로즈 → 얇은 선 라인아트)

- 날짜: 2026-07-24
- 상태: **설계 확정** (브레인스토밍 승인 완료). 구현 미착수.
- 결정 요약: 기능은 유지하고 (1) **IA·화면 구조를 아키타입 시스템으로 통일**, (2) 비주얼을
  2026-07-23 소프트로즈에서 **두들 복귀 → 얇은 선 라인아트(방향 B)** 로 전환, 액센트 = **퍼시먼
  코랄 `#FF4D3D`**, 타이포 = **Pretendard 단일**.

## 배경 / 동기

사용자 진단: "화면마다 구조가 따로논다." 실제로 각 화면이 SafeArea·배경·ScrollView/FlatList·
헤더·탭 클리어런스·폭 캡을 **손수 제각각 배선**한다. `Foundation.tsx`에 `PageHeader`/`StateView`/
`ContentColumn`/`ConfirmDialog`가 이미 있으나 화면들이 이를 **일관되게 조립하지 않아** 결이 분열됨
(예: `home.tsx`는 PageHeader 대신 자체 헤더, `chats.tsx`는 StateView는 쓰되 컨테이너·클리어런스 수동).

동시에 비주얼 방향도 전환: 2026-07-23 소프트로즈(웜 로즈 종이·화이트 카드·blur 섀도)를 버리고
**두들 아이덴티티로 복귀하되 옛 2px 블랙 워블이 아닌 얇은 선 라인아트로 진화** — 세련·트렌디.

두 작업은 **직교**한다: 아키타입 시스템 = 골격, 라인아트 = 스킨. 골격을 먼저 세우고 스킨을 입힌다.

## 범위

- **포함**: 기능 인벤토리 정리 · 화면→아키타입 매핑 · `AppScreen` 공통 골격 신설 · 전 화면을
  아키타입으로 리팩터 · `theme.ts` 라인아트 토큰 교체 · 프리미티브(Doodle*) 룩 교체.
- **제외**: 신규 기능 없음. 백엔드 변경 없음. 탭 IA 유지(홈·채팅·네이버예약·설정). 파티 게임은
  `FEATURES.partyGame=false` 유지(비활성 화면은 스킨만 따라감).

## 결정 (브레인스토밍에서 확정)

1. 범위 = 기능 유지, IA·화면 재구성.
2. 접근 = **아키타입 시스템 A** (소수 페이지 템플릿 고정).
3. 탭 = 현행 4탭 유지.
4. 비주얼 = 라인아트 **방향 B** (클린 얇은 선 + 원포인트, 워블 없음 = 가장 모던).
5. 액센트 = **퍼시먼 코랄 `#FF4D3D`**.
6. 타이포 = **Pretendard 단일** (Cafe24Dongdong 디스플레이 폐기).

---

## 1. 기능 맵 (유지 — 순수 정리)

| # | 그룹 | 포함 |
|---|------|------|
| 1 | 온보딩·인증 | 소셜 로그인, 동의, 권한, 본인인증, 프로필 온보딩 |
| 2 | 블라인드 스피드 데이트 ⭐메인 | 인트로(반경·조건), 세션(단계 로테이션·상호선택) |
| 3 | 연결·대화 | 프로포즈(받은/보낸), 매치, 채팅 목록, 채팅 스레드 |
| 4 | 데이트 실행 | 데이트플랜 합의, 네이버 맛집 탐색·예약링크 |
| 5 | 알림 | 푸시·인앱 알림 목록 |
| 6 | 나·설정 | 프로필/설정, 차단관리, 신고, 계정삭제, 약관·개인정보 |
| 7 | [비활성] 파티 게임 | AI찾기 월드 — 코드 보존, 플래그 off |

## 2. 화면 맵 (라우트 → 아키타입)

아키타입 6종: **Hub / List / Detail / Flow / Sheet / Immersive**.

| 화면 | 라우트 | 그룹 | 아키타입 |
|------|--------|------|----------|
| 홈 허브 | `(tabs)/home` | — | **Hub** |
| 로그인 | `login` | 1 | Flow |
| 동의 | `consent` | 1 | Flow |
| 권한 | `permissions` | 1 | Flow |
| 본인인증 | `verify-identity` | 1 | Flow |
| 프로필 온보딩 | `onboarding` | 1 | Flow |
| 약관 / 개인정보 | `terms` `privacy` | 1 | Detail(문서) |
| 스피드데이트 인트로 | `speed-date/index` | 2 | Flow |
| 스피드데이트 세션 | `speed-date/[id]` | 2 | **Immersive** |
| 매칭 대기 | `matching` | 2/3 | Flow (파티 off→home 리다이렉트) |
| 프로포즈 | `(tabs)/proposals` | 3 | List (탭바 숨김·홈서 push) |
| 채팅 목록 | `(tabs)/chats` | 3 | List |
| 채팅 스레드 | `chat/[roomId]` | 3 | Detail(대화) |
| 데이트플랜 | `date-plan/[matchId]` | 4 | Detail+액션 |
| 네이버 맛집 | `(tabs)/naver-reserve` | 4 | List+지도 |
| 알림 | `(tabs)/notifications` | 5 | List (탭바 숨김) |
| 설정 | `(tabs)/settings` | 6 | List(설정) |
| 차단관리 | `blocks` | 6 | List |
| 신고 | `report/[profileId]` | 6 | Flow(폼) |
| 계정삭제 | `delete-account` | 6 | Flow(비가역) |
| 파티 월드 | `party/[id]` | 7 | Immersive (비활성) |

관찰: 20개 화면이 실질 6개 아키타입으로 수렴. **List가 6개로 최다** → 여기 일관성 체감 가장 큼.

---

## 3. 아키타입 시스템

### 3.1 공통 골격 `<AppScreen>` (신규 — 유일한 화면 래퍼)

지금 화면마다 손수 배선하는 것을 한 컴포넌트로 흡수. 모든 비-Immersive 화면이 통과.

```tsx
<AppScreen
  header={{ title, description?, back?, action? }}   // = PageHeader 재사용
  body="scroll" | "list" | "plain"                    // 스크롤 / FlatList 슬롯 / 고정
  footer={<primary action>}                           // 하단 고정 액션존(옵션)
>
  {children}
</AppScreen>
```

자동 처리:
- `colors.paper` 배경 + SafeArea top 인셋.
- `ContentColumn`(maxWidth `layout.contentMax`=560, 중앙 정렬), 가로 패딩 `layout.screenGutter`=20.
- `useTabBarClearance()` 하단 패딩; `footer`는 클리어런스 위에 고정.
- `body="list"` 는 FlatList를 받아 빈/로딩/에러 시 `StateView`로 폴백.

화면 파일은 **콘텐츠만** 넣는다. 자체 SafeArea/헤더/컨테이너 배선 금지.

### 3.2 아키타입 6종 (= AppScreen 프리셋)

| 아키타입 | body | header | footer | 콘텐츠 규칙 |
|----------|------|--------|--------|-------------|
| **Hub** (홈) | scroll | 인사(back 없음) | 없음 | 상단 primary 히어로 1 + 섹션 그룹 카드. 화면당 primary 1 |
| **List** | list | 타이틀(+세그먼트 옵션) | 없음 | 빈/로딩/에러 = `StateView` · 공용 `ListRow`+`Separator` |
| **Detail** | scroll | back+타이틀 | primary 1 고정 | 대상 정보 섹션 + 하단 고정 액션 |
| **Flow** | scroll/plain | back+타이틀 | primary(다음/제출) 고정 | 단일 초점 · 스텝 인디케이터 옵션 |
| **Sheet** | Modal | 핸들+타이틀 | 액션 행 | 바텀시트/다이얼로그(`ConfirmDialog`=확인형) |
| **Immersive** | 골격 밖 | 자체 | 자체 | **예외 2개만**: 스피드데이트 세션·파티 월드 |

### 3.3 일관성 규칙 ("따로논다" 실제 해결책)

1. 헤더 = **PageHeader 하나로** 통일. 자체 헤더 금지.
2. 폭 = **ContentColumn(560)** 항상. 가로 패딩 = `screenGutter`(20) 항상.
3. 섹션 리듬 = 그룹 간격 `space.x5`, 리스트 행 minHeight 52/72 고정.
4. 빈·로딩·에러 = **StateView 하나로** 항상.
5. primary 위치 = Detail/Flow는 하단 고정 footer, Hub는 히어로. 화면당 primary 1개.
6. 행·카드 = 공용 `ListRow`·`DoodleCard`만. 일회성 컨테이너 금지.

신규 코드 = `AppScreen` + `ListRow` 둘뿐. 나머지는 기존 Foundation/Doodle 재사용 → 저위험.

---

## 4. 라인아트 비주얼 토큰 (`apps/mobile/src/lib/theme.ts` 교체 대상)

미학 원칙: **외곽선 우선, 그림자 최소, 색은 코랄 1점.** 옛 두들의 2px 블랙·하드 스티커 그림자·
손글씨를 버리고, 얇은 선·헤어라인·클린 산세리프로 세련되게.

### colors
| 토큰 | 값 | 용도 |
|------|-----|------|
| `ink` | `#181514` | 먹선·본문 (따뜻 니어블랙) |
| `paper` | `#FBFAF8` | 페이지 그라운드 (살짝 웜 오프화이트) |
| `card` | `#FFFFFF` | 카드 서피스 |
| `line` | `#E8E5E0` | 헤어라인 divider·행 구분 |
| `outline` | `#E0DBD3` | 카드·인풋 외곽선 |
| `grayDark` | `#57534E` | 보조 텍스트 (AA) |
| `grayMid` | `#78716C` | 캡션·비활성 (white 위 ≥4.5:1) |
| `accent` | `#FF4D3D` | 브랜드 코랄 — **선·아이콘·활성탭·틴트 전용 (흰글씨 X)** |
| `accentStrong` | `#D6361F` | **흰글씨 얹는 코랄 fill** (버튼·배지). white 4.77:1 AA통과 |
| `accentPressed` | `#B92E1A` | 버튼 눌림 |
| `accentFill` | `#FFE7E3` | 연코랄 틴트 (hero 배경·pressed) |
| `onAccent` | `#FFFFFF` | 코랄 위 글씨 |
| `danger` | `#C4122F` | 파괴적 액션 — **쿨 크림슨** (웜 코랄과 색상 분리) |
| `dangerFill` | `#FCE8EC` | danger 서피스 |
| `success` / `warning` | `#257A55` / `#9A5D00` | 유지 |

**접근성 불변식(반드시 지킬 것)**:
- `accent`(#FF4D3D)는 흰글씨 대비 3.29:1 = **AA 실패**. 흰글씨 얹는 서피스(버튼·배지)는 무조건
  `accentStrong`. 밝은 코랄은 선/아이콘/틴트/활성상태에만.
- `danger`는 웜 코랄과 혼동 방지 위해 **쿨 크림슨**으로 색상 분리(파괴적 확인 최종에만).

### 타이포 (Pretendard 단일, 번들 Regular/SemiBold)
- `display` 28 / `title` 22 / `heading` 19 = SemiBold. 큰 타이틀 letter-spacing −0.4~−0.6.
- `body` 16 / `caption` 13 = Regular. `label` 15 = SemiBold.
- 계층은 크기+웨이트+코랄+트래킹으로. 하드코딩 fontFamily 금지, `type.*`/`fonts.*` 토큰만.
- ⚠️ `fonts.display`/`type.display`·`type.title`의 `Cafe24Dongdong_400Regular` → Pretendard SemiBold로
  교체. `app/_layout.tsx` `useFonts`에서 동동 로드 제거.

### 선·형태
- 선굵기: 헤어라인 1(divider) · 외곽 1.25(카드·인풋) · 강조 1.5(hero·활성) · 아이콘 Lucide stroke 1.5.
- 라운드(균일): card 18 · button 14 · input 14 · chip 999 · sheet 20.
- **elevation = 외곽선 우선.** `doodle.shadow`(하드 오프셋) 폐기. `shadow.card`는 거의 flat(카드는
  outline로 분리), `shadow.elevated`(소프트)는 모달·시트·hero에만.

## 5. 컴포넌트 매핑 (이름 유지 — 두들 시대 명칭 그대로)

| 컴포넌트 | 라인아트 룩 |
|----------|-------------|
| `DoodleButton` | primary = `accentStrong` fill + 흰글씨 / secondary = 화이트 + `outline` 선 / danger = 화이트+크림슨 선, dangerSolid = 크림슨 fill |
| `DoodleCard` · `WobbleBox` | 화이트 + `outline` 헤어라인, 그림자 없음 (WobbleBox는 이미 순수 라운드 View) |
| `DoodleChip` | outline pill, on = 코랄 |
| `DoodleTabBar` | 활성 아이콘 `accent`, 비활성 `grayMid`, 상단 1px `line` |
| `DoodleFace` | **얇은 라인 버전** — 빈상태에 두들 감성 유지 |
| 아이콘 | Lucide outline, stroke 1.5, `ink` |

## 6. 와이어프레임

브레인스토밍 비주얼 컴패니언 목업 보존: `.superpowers/brainstorm/*/content/`
- `01-skeleton.html` — AppScreen 골격 해부 + 6 아키타입.
- `02-lineart-direction.html` — 방향 A/B/C 비교 (B 선택).
- `03-accent-color.html` — 코발트/코랄/바이올렛 (코랄 선택).

아키타입별 레이아웃 요지(세로 375pt 기준):
- **Hub(홈)**: [인사 헤더] → [블라인드 데이트 히어로 카드(코랄 외곽)] → ['최근' 섹션 라벨 + 허브 카드:
  프로포즈/알림/게임파티 행]. 탭바 홈 활성.
- **List(채팅)**: [타이틀 헤더] → [행 리스트(아바타+이름+미리보기+안읽음 배지)], 빈 = StateView.
- **Detail(데이트플랜)**: [back+타이틀] → [정보 카드 섹션] → [하단 고정 '확정' CTA].
- **Flow(스피드데이트 인트로)**: [back+타이틀] → [스텝 인디케이터] → [반경 칩 그룹] → [하단 '시작' CTA].
- **Sheet(신고 확인)**: 반투명 위 바텀시트(핸들+타이틀+취소/신고 액션 행).
- **Immersive(세션)**: 전체화면 자체 크롬, 골격 밖.

## 7. 마이그레이션 / 롤아웃

골격과 스킨이 직교하므로 순서:
1. **P0 토큰** — `theme.ts` 라인아트 값 교체(consumer ~48개가 값만 이동). 동동 폰트 제거.
2. **P1 프리미티브** — Doodle*/Foundation 룩을 라인아트로. `DoodleFace` 라인 버전.
3. **P2 골격** — `AppScreen` + `ListRow` 신설, `PageHeader`/`StateView` 흡수.
4. **P3 화면 리팩터** — 아키타입별로: List 6종 → Detail → Flow → Hub. Immersive 2개는 스킨만.
5. **P4 문서** — CLAUDE.md 디자인 섹션·메모리 갱신.

각 페이즈 후 tsc + mobile 테스트 + 브라우저 E2E(홈·채팅·speed-date 인트로) 확인.

## 8. 리스크 / 주의점

- **코랄 대비**: `accent` 위 흰글씨 AA 실패 — `accentStrong` 강제 규칙 어기면 접근성 회귀. 리뷰 체크.
- **danger 혼동**: 코랄과 크림슨이 둘 다 붉음 — danger는 파괴적 최종 확인에만, `serious` 라벨 병행.
- **CLAUDE.md/메모리 대량 stale**: 현 문서가 "소프트 로즈"를 살아있는 규칙으로 서술 → P4에서
  라인아트로 전면 교체 필요(팔레트·타이포·프리미티브 설명 전부).
- **동동 폰트 제거**: `useFonts` 로드·`type`/`fonts` 참조 동시 수정 안 하면 폰트 미로드 크래시.
- **파티 게임 픽셀 아트**: 의도된 예외(Kenney CC0) — 비활성이나 재활성 시 라인아트와 별개 유지.
- **RN gotchas 유지**: 단면 dashed→`DashedLine`, Switch trackColor 웹 교정, Stack contentStyle `paper`.

## 9. 논골 (이번 범위 아님)

- 신규 기능·백엔드·데이터모델 변경.
- 탭 IA 재편(현행 4탭 유지).
- 파티 게임 재활성.
- 웹(`apps/web`) 비주얼 — 모바일 전용 작업.

## 10. 성공 기준

- 20개 화면이 6개 아키타입으로 구현, 전부 `AppScreen` 통과(Immersive 2 예외).
- 헤더·폭·간격·빈상태·primary 위치가 화면 간 동일 = "따로논다" 해소.
- 라인아트 스킨 일관 적용, 접근성 불변식(코랄/크림슨) 통과.
- tsc clean · mobile 테스트 그린 · 브라우저 E2E 확인.
