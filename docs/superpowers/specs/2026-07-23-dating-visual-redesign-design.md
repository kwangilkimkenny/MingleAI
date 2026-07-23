# 데이팅 관습형 비주얼 재설계 (두들 → 로맨틱 소프트)

- 날짜: 2026-07-23
- 상태: **구현 완료** (P0 토큰·P1 프리미티브·P2 홈·P3 전 화면·P4 Gaegu 제거·P5 문서). tsc clean,
  mobile 127/127, 브라우저 E2E(홈·설정·speed-date 인트로) 확인.
- 결정: 사용자가 방향 **C(데이팅 관습형 선회)** 선택. 두들 손그림 아이덴티티를 데이팅 앱 관습
  (포토포워드·소프트·라운드·로즈웜)으로 전환.

## 배경

ui-ux-pro-max DB 대조 결과: 현 코랄 팔레트는 로맨틱-로즈 계열로 방향은 맞으나,
**순백 배경 + 2px 블랙 워블보더 + Gaegu 손글씨** 조합이 데이팅의 따뜻함·신뢰 관습을 밀어냄
(두들 스타일 Best-For = 저널링·교육·동화, 데이팅 아님). 사용자는 브랜드를 데이팅 관습형으로
크게 선회하기로 결정.

## 브랜드 앵커 (확정)

- **Primary = 로즈 `#E11D48`** (DB 데이팅 표준, white 텍스트 AA).
- **나무늘보 로고 유지** (`assets/images/logo.png`) — 브랜드 마크로 존속.
- **Gaegu 손글씨 폐기** — 전 UI Pretendard 라운드 산세리프로.

## 신규 디자인 토큰 (`apps/mobile/src/lib/theme.ts` 교체 대상)

### colors
| 역할 | 값 | 비고 |
|---|---|---|
| primary | `#E11D48` | 메인 CTA·액티브·러버튼. onPrimary `#FFFFFF` |
| primaryDeep | `#BE123C` | pressed |
| secondary | `#FB7185` | salmon 보조 강조 |
| accentWarm | `#EA580C` | 오렌지, 극히 절제 |
| background | `#FFF5F5` | 웜 로즈틴트(순백 폐기). card `#FFFFFF` |
| heading | `#881337` | 와인 — 타이틀·짧은 강조 |
| text | `#2A2228` | 웜 차콜 — 본문(AA) |
| textMuted | `#6E5A61` | 보조 텍스트(≥4.5:1) |
| border | `#FBD5DB` | 소프트 로즈 헤어라인(블랙보더 폐기) |
| divider | `#F3E7EA` | |
| fill / fillDeep | `#FFF0F1` / `#FDE8EA` | 로즈 서피스 |
| success / warning | `#257A55` / `#9A5D00` | 유지 |
| danger / dangerFill | `#B3261E` / `#FDECEA` | primary 로즈와 구분되는 브릭 레드 |

### shape / elevation
- radius: sm 12 · md 16 · lg 20 · xl 24 · pill 999 (균일 — 워블·회전 폐기).
- shadow: 소프트 blur. card `{ shadowColor:#4A2530, opacity:0.10, radius:12, y:4, elevation:2 }`,
  elevated `{ opacity:0.14, radius:20, y:8, elevation:4 }`. 하드 오프셋 잉크 섀도 폐기.

### typography (Gaegu 폐기)
- display `Pretendard_700Bold` / title `Pretendard_700Bold` / heading `Pretendard_600SemiBold`
- body `Pretendard_400Regular` / label `Pretendard_600SemiBold` / caption `Pretendard_400Regular`
- 스케일: display 28/34 · title 22/28 · heading 19/25 · body 16/24 · label 15/21 · caption 13/18. LH 1.5.
- (선택 후속: 라운드 한글 디스플레이 폰트 추가 검토 — 기본은 Pretendard.)

## 프리미티브 마이그레이션 전략 — 이름 유지, 내부만 교체

핵심: `WobbleBox`(DoodleSvg.tsx) 내부를 **지터 SVG 패스 → 균일 라운드 View(소프트 보더 + blur
섀도)**로 교체하면, 이를 쓰는 **모든 Button/Card/Chip/Input이 화면 코드 수정 0으로 전면 소프트화**.
- `WobbleBox`: borderRadius 균일 · borderColor `border` · blur 섀도 · 회전 제거.
- `DoodleButton`: 로즈 fill(primary)/white+로즈 헤어라인(secondary) · pill · press scale 0.97 ·
  **disabled에 opacity dim 추가**(기존 감사 finding 동시 해결) · busy 스피너 prop 추가(감사 finding).
- `DoodleCard`/`DoodleChip`/`doodleInputStyle`: 라운드·소프트 보더·blur.
- 컴포넌트 **이름은 초기 단계 유지**(빠른 플립). P5에서 `Soft*`/`UI*` 리네임 선택(코드모드).

## 페이즈 (토큰 먼저 = 파급 최대, 다중 커밋 필수)

- **P0 — 토큰** (`theme.ts`): 위 colors/shape/shadow/fonts 교체. 대부분 화면 자동 상속.
- **P1 — 프리미티브** (`DoodleSvg.tsx`/`Doodle.tsx`/`Motion` 유지): WobbleBox·Button·Card·Chip·
  Input 리스킨. 이름 유지 → 화면 코드 무변경으로 전체 룩 전환. + disabled/busy 감사 finding 해결.
- **P2 — 홈 재설계**: 포토/아바타 포워드 히어로 + 라이브 지표(대기 인원/활성) + primary CTA +
  journey 첫방문 한정/접기 + disabled 파티 슬림 강등.
- **P3 — 화면별** (우선순위): **speed-date(메인 기능) 최우선** → login·onboarding·settings
  (내 프로필 카드 승격, 포토포워드)·chats·proposals·notifications·matching. 아바타/사진 존재감 강화.
- **P4 — 타이포 정리**: 잔존 Gaegu 제거 + 가독성 패스(라인렝스·대비).
- **P5 — 정리·문서**: `doodle-path.ts`·워블 로직·미사용 두들 에셋 은퇴. CLAUDE.md 디자인 시스템
  섹션·`DESIGN.md`·메모리(`doodle-bw-mobile-design`,`among-us-real-game`) 대폭 갱신. 컴포넌트
  리네임(선택).

## 범위 밖 / 유지
- 픽셀 게임월드 = 이미 비활성(`FEATURES.partyGame=false`) → 재설계 대상 아님. 재활성 시 별도 판단.
- 안전 시맨틱(danger/consent/serious) 유지, 로즈 primary와 색 분리 준수.
- reduced-motion·safe-area·터치 44pt 등 접근성 규칙 유지(이전 감사 finding들 P1~P3에서 동시 해결).

## 리스크
- CLAUDE.md·`DESIGN.md`·메모리에 깊이 문서화된 **두들 시스템 전면 폐기** — 큰 문서 churn(P5).
- ~40 컴포넌트 + 전 화면 영향 → 한 번에 하지 말 것. 페이즈별 커밋 + 각 페이즈 후 E2E/시각 확인.
- 이전 세션의 두들/코랄 결정 다수를 뒤집음 — git log/plan에 전환 근거 명시.

## 열린 항목 (기본값으로 진행, 필요 시 조정)
- 라운드 한글 디스플레이 폰트 추가 여부 — 기본 Pretendard.
- 라이브 지표(대기 인원)용 백엔드 count API — P2에서 필요, 없으면 스텁/생략.
- 컴포넌트 리네임 실행 여부 — P5 선택.
