# MingleAI 디자인 시스템 — 두들링 아트 (흑백)

> **컨셉: "손으로 그린 흑백 스케치북 (A Hand-drawn B&W Sketchbook)"**
> 모든 화면은 검정 펜으로 흰 종이에 그린 일기장의 한 페이지다. AI 에이전트는 종이 위에서 살아 움직이는 두들 캐릭터이고,
> 매칭이란 두 낙서 얼굴이 손그림 선과 하트로 연결되는 순간이다.
> 차가운 알고리즘을 따뜻한 손그림으로 감싸 — "AI가 대신 나가주는 안전한 만남"이라는 제품 약속을 정서적으로 번역한다.
> **색을 뺀다.** 귀여움은 컬러가 아니라 둥글고 삐뚤한 손선·두들 표정·굵은 흑백 대비에서 나온다. → 귀엽지만 심플.

이 문서가 프로젝트 디자인의 **단일 소스(single source of truth)** 다. 두들 렌더링의 **방식과 원리**는 §3에,
색 체계는 §1에 정의된다. 현재 웹앱(`src/lib/theme.ts` · `src/lib/doodle.ts`)은 초기 핑크 강조 버전으로 남아 있고,
**흑백 방향이 v2 모바일(RN+Expo)의 확정 시스템**이다 — 아래 토큰이 go-forward 기준.

라이브 미리보기(권장): `design/mobile-wireframes.html` — 모바일 6화면 흑백 와이어프레임 (브라우저로 바로 열기).
렌더 캡처: `design/preview-mobile-wireframes.png`. 초기 핑크 스타일 타일: `design/doodle-style-tile.html`.

---

## 1. 컬러 — 순수 흑백 (검정 / 흰색)

유채색을 **완전히 뺀다.** 먹선(검정)과 종이(흰색), 그 사이 회색 3단계뿐. 색이 없으니 화면이 조용하고,
위계는 색이 아니라 **크기·굵기·검정 반전 블록**으로만 생긴다. → 귀엽지만 심플.

| 토큰 | 값 | 용도 |
|---|---|---|
| `ink`        | `#17150F` | 모든 윤곽선·텍스트 (순검정 대신 살짝 따뜻한 먹) |
| `ink-2`      | `#45413A` | 보조 텍스트 |
| `ink-3`      | `#8A857C` | 캡션 · 비활성 |
| `line-faint` | `#D9D5CC` | 도트그리드 · 연한 구분선 |
| `paper`      | `#FFFFFF` | 화면 종이 |
| `paper-warm` | `#FCFBF7` | 페이지 배경 |
| `smoke`      | `#F1EFE9` | 눌린 면 · 게이지 트랙 |
| `smoke-2`    | `#E7E4DC` | 조금 더 진한 면 · 형광펜 대체 |

**색 없이 위계를 만드는 3원칙:**
- **강조 = 반전.** 강조색이 없으므로, 튀어야 하는 요소(AI 추천 카드·CTA 버튼·안읽음 배지·통계)는 **검정 블록에 흰 글자**로 뒤집는다. 화면당 반전 블록은 1~2개로 제한 — 남발하면 심플함이 깨진다.
- **밀도 = 해칭.** 면을 회색으로 칠하는 대신 검정 빗금 `repeating-linear-gradient(45deg)`으로 채워 흑백만으로 진하기를 표현한다(게이지·커버 일러스트).
- **형광펜도 흑백.** 핑크 워시 대신 `smoke-2` 회색 밑줄 블록으로 핵심 단어를 강조.

> 유채색 사용량 = **0**. 상태 구분(예정/진행/완료)조차 색이 아니라 채움(빗금/반전/외곽)으로 나눈다.

## 2. 타이포그래피 — 균형 전략

손글씨는 성격, 산세리프는 가독성. 둘을 역할로 나눈다.

| 역할 | 폰트 | 적용 |
|---|---|---|
| Display | **Gaegu (개구) 700** | h1–h6, 버튼, 칩, 라벨, 짧은 카피 |
| Body | **Pretendard** | 긴 본문, 폼 입력값, 리포트 설명 |
| Accent | **Shantell Sans** | 영문·숫자 강조 (`94% match`, 로고의 AI) |
| Scribble | **Gamja Flower** | 메모처럼 휘갈긴 캡션 (아주 가끔) |

> ⚠️ 14px 이하 긴 한글 본문에 손글씨를 쓰지 않는다 — 가독성이 깨진다. 손글씨는 크고 짧은 텍스트에만.

폰트는 `app/layout.tsx`의 `<head>` `<link>`로 로드(Google Fonts + Pretendard CDN).

## 3. 두들 렌더링 — 방식과 원리 (Doodle Surface)

> **핵심 원리:** 손그림 느낌은 "그림 파일"이 아니라 **4개 CSS/SVG 기법의 조합**으로 만든다. 이미지 애셋 0, 신규 의존성 0.
> 그래서 텍스트는 항상 선명하고(스크린리더·검색 OK), 어떤 요소에도 즉시 입힐 수 있다.

직선·정원을 쓰지 않는다. 모든 박스는 손으로 그린 듯해야 한다:

1. **삐뚤 border-radius** — `15px 21px 15px 20px / 20px 15px 21px 16px` (모서리마다 다른 곡률 → 정원·직각 제거)
2. **`::before` 가상요소 테두리 + `feTurbulence`→`feDisplacementMap` 변위 필터** (`url(#doodle-wobble)` / 와이어프레임에선 `url(#dw)`) — **테두리만 손그림처럼 떨리고 콘텐츠 텍스트는 왜곡되지 않는다**(필터를 가상요소에만 적용). `isolation:isolate` + `z-index:-1`로 배경 위·콘텐츠 아래에 깐다.
3. **단색 오프셋 그림자** — 블러 그림자 금지. `4px 5px 0 #17150F`처럼 번지지 않는 검정 오프셋만 → 종이에 스티커를 붙인 물성.
4. **미세 회전** — 카드는 `-1.5°~2°`로 살짝 기울여 "테이프로 붙인 메모" 물성.

**흑백에서 밀도·채움:** 회색으로 칠하지 않고 **검정 빗금** `repeating-linear-gradient(45deg, #17150F 0 2.2px, transparent 2.2px 5.5px)`으로 마커 해칭을 모사(게이지·커버). 채움이 필요하면 회색 대신 **검정 반전 블록**(§1).

**두 갈래 구현:**
- **웹앱(현행)** — `doodleSurface()` 헬퍼(`lib/doodle.ts`)가 위를 한 번에 반환, MUI `MuiCard`/`MuiButton`/`MuiChip`에 전역 적용 → **변환 안 한 페이지도 자동 두들화**.
- **모바일 와이어프레임(신규 기준)** — `design/mobile-wireframes.html`이 레퍼런스 구현. 순수 HTML/CSS + 인라인 SVG(`<symbol>` 아이콘 스프라이트)로 동일 원리를 재현.
- **RN+Expo(구현 완료)** — `feTurbulence`/`feDisplacementMap`은 `react-native-svg` 네이티브에서 미지원이라 이식 불가. 대신 `apps/mobile/src/lib/doodle-path.ts`(`wobbleRect`/`hatchSegments`/시드 난수 `mulberry`)로 **사전 계산한 지터 패스**를 `apps/mobile/src/components/DoodleSvg.tsx`(`WobbleBox`/`MatchGauge`/`DoodleFace`/`DoodleChip`/`DashedLine`) SVG 컴포넌트로 렌더.

## 4. 두들 모티프 사전

제품 도메인 전용 손그림 아이콘. `components/common/doodles.tsx`에서 SVG 컴포넌트로 제공.

| 모티프 | 의미 | 컴포넌트 |
|---|---|---|
| ♡ 하트 | 좋아요·매칭 | `DoodleHeart` |
| ✦ 반짝이 | AI 분석·매직 | `DoodleSparkle` |
| 🙂 두들 얼굴 | AI 에이전트 아바타 | `DoodleFace` |
| ⤳ 스프링 연결선 + 하트 | 매칭 | `DoodleConnector` |
| 💬 말풍선 | AI 대화 | `DoodleSpeech` |
| 게이지(해칭) | 궁합 점수 | `MatchGauge` |
| 연필이 원을 그림 | 로딩 | `DoodleSpinner` |

## 5. 모션 원칙

- **그려지는 등장** — 윤곽선이 `stroke-dashoffset`로 스스로 그려짐 (signature).
- **boil** — 윤곽선이 미세하게 살아 떨림. **아껴 쓴다.**
- **hover** — 스크리블 채움 · 형광펜 스윕 · 살짝 회전/확대.
- **stagger** — 카드가 톡톡 튀어 오르며 순차 등장.
- **접근성 필수** — `@media (prefers-reduced-motion: reduce)`에서 모든 애니메이션 off. 손글씨 본문 명도대비·최소 크기 확보.

## 6. 적용 현황 / 로드맵

- [x] 디자인 토큰 (`lib/doodle.ts`) + MUI 전역 테마 (`lib/theme.ts`)
- [x] 폰트 로드 (`app/layout.tsx`) + 전역 종이/그레인/도트그리드 (CssBaseline)
- [x] 두들 프리미티브 (`components/common/doodles.tsx`): Spinner·Gauge·Face·Heart·Sparkle·Connector·Speech
- [x] 플래그십 적용: `LoadingSpinner`, `EmptyState`, `MatchScoreCard`, `PartyCard`, `StatsCard`
- [x] 페이지 단위 확대: 대시보드·파티·프로필·리포트·어드민 — 전부 테마 상속으로 두들화(하드코딩 색 0건), 랜딩 히어로는 스케치북 표지로 교체
- [x] 3D 파티 라이브 뷰어 두들화 — 종이 무대(모눈 바닥·잉크 걸레받이·손그림 무대원), MeshToon+Outline 캐릭터/소품, 잉크 표정·도들 말풍선, 종이/잉크/핑크 오버레이(HUD·채팅·라운드·완료), 라이브 페이지 헤더
- [x] **흑백 재구성 + 모바일 특화 와이어프레임** — 컬러를 순수 흑백(유채색 0)으로 전환, 색 대신 반전·해칭·굵기로 위계. 모바일 6화면(온보딩·홈 피드·모임 상세·AI 궁합 리포트·채팅/매칭·프로필) + 하단 탭바 패턴을 `design/mobile-wireframes.html`에 구현·렌더 검증. → **v2(RN+Expo) 확정 시스템**

### 다음(제안, 미착수)
- [x] 흑백 토큰을 `lib/doodle.ts`/`theme.ts`에 반영(핑크 → 반전/해칭) 또는 RN 앱 신규 토큰으로 포팅 — **완료.** RN 앱 신규 토큰 경로: `apps/mobile/src/lib/theme.ts`의 `colors`/`doodle` 토큰.
- [x] 와이어프레임 → 실제 RN 컴포넌트(두들 보더 Hook·SVG 아이콘 세트) 구현 — **완료.** `apps/mobile/src/lib/doodle-path.ts`(wobbleRect/hatchSegments/mulberry 시드 지터) + `apps/mobile/src/components/DoodleSvg.tsx`(WobbleBox/MatchGauge/DoodleFace/DoodleChip/DashedLine) + `DoodleTabBar.tsx`/`DoodleHero.tsx` + wobble 적용된 `Doodle.tsx`, 홈/인증/리스트/상세 화면 전반에 반영.

> 미리보기(흑백·최신): **`mobile-wireframes.html`** → 렌더 `preview-mobile-wireframes.png`
> 미리보기(핑크·초기): `doodle-style-tile.html`, `preview-app-landing.png`, `preview-app-login.png`, `preview-app-dashboard.png`, `preview-app-3d-live.png`
