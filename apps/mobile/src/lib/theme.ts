/**
 * Mingle brand primitives — dark brown × blush pink.
 *
 * Components consume semantic tokens (`colors`, `dark`) below instead of reaching
 * into this scale directly. That keeps the palette consistent across light, dark, and editorial
 * surfaces while allowing each context to choose an accessible shade.
 */
export const brandPalette = {
  brown950: "#1A120C",
  brown900: "#241C15",
  brown850: "#2E251C",
  brown800: "#221D18",
  brownInk: "#181412",
  blush50: "#FBE8ED",
  blush200: "#F2BCC8",
  blush300: "#E59BAD",
  blush500: "#C9657F",
  blush700: "#A63D5A",
  blush800: "#873047",
  creamText: "#FBF4EC",
  // 2차 강조 — 웜 골드(메타·상태)와 세이지(가능/성공). 브라운·블러시와 같은 웜 계열이라
  // 브랜드를 흐리지 않으면서 화면에 색의 층을 하나씩 더한다(2026-08-07 팔레트 보완).
  gold200: "#EFCB92",
  gold400: "#E3B778",
  gold600: "#C99A55",
  sage300: "#B7D8BF",
  sage400: "#9EC7A8",
} as const;

/**
 * Functional light palette — warm paper, dark-brown line work, and one blush-pink point color.
 *
 * `accent` is for strokes/icons/active states. White text on filled buttons and badges MUST use
 * `accentStrong` (6.11:1 against white). Danger stays a cooler crimson so destructive actions do
 * not read as the primary Mingle action.
 */
export const colors = {
  ink: brandPalette.brownInk, // 먹선·본문 (다크 브라운)
  paper: "#FCF9F8", // 페이지 그라운드 (블러쉬 기가 도는 웜 오프화이트)
  card: "#FFFFFF", // 카드 서피스
  heading: brandPalette.brown800, // 타이틀 다크 브라운
  grayDark: "#57534E", // 보조 텍스트 (AA)
  grayMid: "#78716C", // 캡션·비활성 (white/paper 위 AA)
  grayLight: "#E9E2E2", // = line 값 (divider) — 이름 유지
  line: "#E9E2E2", // 헤어라인 divider·행 구분
  border: "#E3D9D9", // = outline 값 (카드·인풋 외곽) — 이름 유지
  outline: "#E3D9D9", // 카드·인풋 외곽선 (신규 별칭)
  fill: "#F8F1F2", // 연한 블러쉬 뉴트럴 fill
  fillDeep: "#F0E6E8", // 더 진한 블러쉬 뉴트럴 fill
  // Point color — blush pink. `accentStrong` is reserved for surfaces carrying white text.
  accent: brandPalette.blush500, // 브랜드 블러쉬 — 선·아이콘·활성탭 (흰글씨 X)
  accentBright: brandPalette.blush200, // 밝은 블러쉬 — 일러스트·표현
  accentDeep: brandPalette.blush800, // pressed (레거시 이름 유지)
  accentPressed: brandPalette.blush800, // 눌림
  accentSoft: brandPalette.blush300, // 밝은 블러쉬 보조
  accentStrong: brandPalette.blush700, // 흰글씨 버튼·배지 — white 6.11:1 AA
  accentFill: brandPalette.blush50, // 연한 블러쉬 틴트
  onAccent: "#FFFFFF", // 블러쉬 위 글씨
  success: "#257A55",
  warning: "#9A5D00",
  warningFill: "#FFF0D6",
  // Cool crimson — separated from blush so a destructive action never reads as the primary CTA.
  danger: "#C4122F",
  dangerFill: "#FCE8EC",
} as const;

/**
 * Production layout primitives. Screens compose these tokens rather than inventing one-off
 * spacing. The 4pt base grid keeps dense HUDs and calm social screens visually related.
 */
export const space = {
  x1: 4,
  x2: 8,
  x3: 12,
  x4: 16,
  x5: 20,
  x6: 24,
  x8: 32,
  x10: 40,
} as const;

export const type = {
  // Pretendard 단일 — 클린 모던, 계층은 크기+웨이트+블러쉬 포인트.
  display: { fontFamily: "Pretendard_600SemiBold", fontSize: 28, lineHeight: 36 },
  title: { fontFamily: "Pretendard_600SemiBold", fontSize: 22, lineHeight: 29 },
  heading: { fontFamily: "Pretendard_600SemiBold", fontSize: 19, lineHeight: 25 },
  body: { fontFamily: "Pretendard_400Regular", fontSize: 16, lineHeight: 24 },
  label: { fontFamily: "Pretendard_600SemiBold", fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: "Pretendard_400Regular", fontSize: 13, lineHeight: 18 },
} as const;

export const control = {
  minTouch: 44,
  buttonHeight: 50,
  compactHeight: 40,
} as const;

/**
 * Dark editorial (홈 테마) — dark-brown cinematic ground with cream serif copy, blush-pink labels,
 * and a cream pill CTA. Applied to brand / entry / gate / flow / immersive screens
 * (home·login·onboarding·gate·speed-date). List/data screens stay LIGHT (line-art `colors`) for
 * readability — 사용자 방침 "다크 무드 유지, 리스트만 밝게" (2026-07-24).
 */
/**
 * 다크 토큰. 글자 대비는 원래도 넉넉했지만(크림 13:1+, 뮤트 5.9:1) **면과 선**이 너무 붙어 있어
 * 카드가 배경에서 뜨지 않았다(2026-08-06 대비 감사: 카드/배경 1.10:1, 테두리 1.62:1, 선택면 1.12:1).
 * surface·surfaceHi를 한 단씩 올리고 hairline 알파를 키워 구조가 읽히게 했다. 값 변경 시
 * `theme.test.ts`의 대비 불변식이 지켜지는지 확인할 것.
 */
export const dark = {
  bg: brandPalette.brown950, // dark-brown page ground
  surface: "#382D23", // 카드/시트 — 배경 대비 1.38:1(구 1.10은 배경에 잠겨 있었다)
  surfaceHi: "#473A2E", // 선택·상승면 — 카드 대비 1.22:1(구 1.00, fill만으론 구분 불가였다)
  text: brandPalette.creamText, // cream body text
  textMuted: "rgba(251,244,236,0.6)", // muted cream
  heading: brandPalette.creamText, // serif heading (cream)
  label: brandPalette.blush200, // blush — eyebrow / label
  border: "rgba(251,244,236,0.28)", // 카드 경계 hairline — 카드 대비 2.35:1
  /** 테두리가 유일한 식별 수단인 컨트롤(고스트 버튼·비활성 칩)용 — 비텍스트 3:1 충족. */
  borderStrong: "rgba(251,244,236,0.42)",
  line: "rgba(251,244,236,0.18)", // divider on dark
  fieldBg: "rgba(251,244,236,0.1)", // input fill on dark
  pill: "#F4F1EA", // cream pill CTA (primary on dark)
  onPill: brandPalette.brown800, // dark text on the cream pill
  accent: brandPalette.blush200, // bright blush — active / small accent on dark
  danger: "#FF7A6E", // brighter red for legibility on dark
  onDanger: "#221109",

  // ── 팔레트 보완(2026-08-07) — 기존 값은 그대로 두고 층·램프·2차 강조만 얹었다. ──
  // 배경 하나에 표면 둘뿐이라 화면이 평평했다. M3의 tonal elevation처럼 위로 갈수록
  // 밝아지는 계단을 만들고, 강조색도 단계(fill → 색 → 진한 색)를 갖게 했다.

  // 다크에서 '우물'(배경보다 어두운 면)은 만들지 않는다 — bg가 이미 검정에 근접해
  // 아무리 어둡게 해도 대비가 1.1을 못 넘는다. 들어간 느낌은 색이 아니라 테두리로 낸다.
  /** 4단 표면 — 시트·다이얼로그·팝오버. 카드(surface)와 겹쳐도 층이 읽힌다. */
  surfaceTop: "#544437",
  /** 상승 표면에 얹는 브랜드 틴트(M3 surfaceTint) — 위로 갈수록 살짝 따뜻해진다. */
  surfaceTint: "rgba(242,188,200,0.05)",

  /** 블러시 램프 — 강조를 하나의 색이 아니라 단계로 쓴다. */
  accentBright: brandPalette.blush50, // 가장 밝은 강조 텍스트
  accentDim: brandPalette.blush300, // 보조 아이콘·비활성 강조
  accentFill: "rgba(242,188,200,0.14)", // 칩·배지의 은은한 채움
  onAccent: brandPalette.brown800, // 블러시 위 잉크 글씨(10.2:1)

  /** 골드 — 메타·아이브로우·"예약 가능" 같은 상태. 블러시(브랜드·활성)와 역할을 나눈다. */
  gold: brandPalette.gold400,
  goldBright: brandPalette.gold200,
  goldFill: "rgba(227,183,120,0.14)",
  onGold: brandPalette.brown800,

  /** 세이지 — 성공·가능·확정. 위험(크림슨)의 반대편. */
  success: brandPalette.sage400,
  successBright: brandPalette.sage300,
  successFill: "rgba(158,199,168,0.14)",
  onSuccess: brandPalette.brown800,

  dangerFill: "rgba(255,122,110,0.14)",

  /** 스크림 — 모달·시트 뒤 배경. 화면마다 흩어져 있던 rgba를 한곳으로. */
  scrim: "rgba(10,7,5,0.6)",
  scrimStrong: "rgba(0,0,0,0.94)",
  /** 히어로·CTA 주변의 은은한 브랜드 광. */
  glow: "rgba(242,188,200,0.18)",
} as const;

export const layout = {
  screenGutter: 20,
  contentMax: 560,
  modalMax: 520,
  hudEdge: 16,
  hudBottom: 20,
  hudGap: 8,
} as const;

/**
 * Type roles — all Pretendard (2026-07-23 dropped Gaegu handwriting from the UI for legibility and
 * a warmer, more trustworthy dating tone). SemiBold is the heaviest bundled weight, so display /
 * title / heading all use it and lean on size + rose color for hierarchy. Loaded in app/_layout.
 */
export const fonts = {
  display: "Pretendard_600SemiBold",
  displayRegular: "Pretendard_400Regular",
  body: "Pretendard_400Regular",
  bodySemibold: "Pretendard_600SemiBold",
} as const;
// Myeongjo serif for dark-editorial headings lives in `src/lib/serif.ts` — it needs `Platform` from
// react-native, which the pure-lib Vitest can't parse, so it is kept out of this pure token module.

/**
 * Soft elevation — blurred, low-opacity shadows in a neutral warm-gray. Line-art is outline-first,
 * so this is reserved for modals / sheets / hero surfaces; flat cards rely on the hairline outline.
 */
export const shadow = {
  card: {
    shadowColor: "#2A2320",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  elevated: {
    shadowColor: "#2A2320",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;

/**
 * Surface tokens — rounded corners + thin ink hairline. `radius` keeps the four-corner shape
 * (WonkyRadius) the primitives expect, but every corner is equal (clean rounded, no wobble).
 * `border` is the hairline width; `shadow` (legacy hard offset) is retained for API stability but
 * unused — line-art elevation is outline-first (blurred `shadow` export above only for modals/sheets).
 */
export const doodle = {
  border: 1.5, // soft hairline stroke width
  radius: {
    button: {
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
      borderBottomLeftRadius: 16,
    },
    card: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomRightRadius: 20,
      borderBottomLeftRadius: 20,
    },
    input: {
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      borderBottomRightRadius: 14,
      borderBottomLeftRadius: 14,
    },
    chip: {
      borderTopLeftRadius: 999,
      borderTopRightRadius: 999,
      borderBottomRightRadius: 999,
      borderBottomLeftRadius: 999,
    },
  },
} as const;

/**
 * Shared navigation-header options — warm ground, rose-ink title, soft rose underline. Headers
 * are hidden app-wide, so this is kept for API stability. Spread into a Stack's screenOptions.
 */
export const doodleHeaderOptions = {
  headerStyle: {
    backgroundColor: colors.paper,
    borderBottomWidth: doodle.border,
    borderBottomColor: colors.border,
  },
  headerTitleStyle: { color: colors.heading, fontFamily: fonts.display, fontSize: 20 },
  headerTintColor: colors.ink,
  headerShadowVisible: false,
};

export const componentTokens = {
  button: {
    minHeight: control.buttonHeight,
    radius: doodle.radius.button,
    horizontalPadding: 18,
  },
  input: {
    minHeight: control.buttonHeight,
    radius: doodle.radius.input,
    horizontalPadding: 14,
  },
  card: {
    radius: doodle.radius.card,
    padding: space.x4,
  },
  chip: {
    minHeight: control.compactHeight,
    radius: doodle.radius.chip,
  },
  tabBar: {
    // 라벨 없는 아이콘 바 — 높이는 터치 타깃(48) + 여백. iconSize는 라벨이 사라진 만큼 키웠다.
    rowHeight: 60,
    iconSize: 25,
  },
} as const;
