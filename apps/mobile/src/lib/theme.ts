/**
 * Mingle brand primitives — dark brown × blush pink.
 *
 * Components consume semantic tokens (`colors`, `masterpiece`, `dark`) below instead of reaching
 * into this scale directly. That keeps the palette consistent across light, dark, and editorial
 * surfaces while allowing each context to choose an accessible shade.
 */
export const brandPalette = {
  brown950: "#1A120C",
  brown900: "#241C15",
  brown850: "#2E251C",
  brown800: "#221D18",
  brownInk: "#181412",
  brownMuted: "#6A6151",
  blush50: "#FBE8ED",
  blush200: "#F2BCC8",
  blush300: "#E59BAD",
  blush500: "#C9657F",
  blushMuted: "#B98291",
  blush700: "#A63D5A",
  blush800: "#873047",
  cream: "#F4F1EA",
  creamText: "#FBF4EC",
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
  partyFloor: "#E9E2D6", // (party game world — disabled; legacy value kept)
  partyRoom: "#FFFDF8",
  partyRoomWarm: "#F8F0E6",
  partyRoomRose: "#F8ECEC",
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
 * Masterpiece (fine-art editorial) surface tokens — hero / entrance / onboarding ONLY.
 * Classical cutout figures on cream paper, Myeongjo serif display, halftone dots, a black pill CTA.
 * Deliberately SEPARATE from the line-art `colors` so the two systems coexist: line-art skins the
 * functional screens (chat/lists/settings), masterpiece skins brand moments. 2026-07-24.
 */
export const masterpiece = {
  cream: brandPalette.cream, // warm paper ground
  creamDeep: "#F4E9EC", // blush-washed hero band
  inkDeep: brandPalette.brown800, // dark-brown serif headline / pill fill
  inkSoft: brandPalette.brownMuted, // muted brown — subhead
  tag: brandPalette.blushMuted, // dusty blush — eyebrow/label
  dot: "#E4C9D0", // blush halftone dot
  pill: brandPalette.brown800, // dark-brown pill CTA fill
  onPill: brandPalette.cream, // text on pill
  pillGhostBorder: "#D5B4BD", // blush outline pill border
} as const;

/**
 * Dark editorial (홈 테마) — dark-brown cinematic ground with cream serif copy, blush-pink labels,
 * and a cream pill CTA. Applied to brand / entry / gate / flow / immersive screens
 * (home·login·onboarding·gate·speed-date). List/data screens stay LIGHT (line-art `colors`) for
 * readability — 사용자 방침 "다크 무드 유지, 리스트만 밝게" (2026-07-24).
 */
export const dark = {
  bg: brandPalette.brown950, // dark-brown page ground
  surface: brandPalette.brown900, // dark card/sheet surface
  surfaceHi: brandPalette.brown850, // raised surface / input fill hint
  text: brandPalette.creamText, // cream body text
  textMuted: "rgba(251,244,236,0.6)", // muted cream
  heading: brandPalette.creamText, // serif heading (cream)
  label: brandPalette.blush200, // blush — eyebrow / label
  border: "rgba(251,244,236,0.16)", // subtle light hairline on dark
  line: "rgba(251,244,236,0.1)", // divider on dark
  fieldBg: "rgba(251,244,236,0.06)", // input fill on dark
  pill: brandPalette.cream, // cream pill CTA (primary on dark)
  onPill: brandPalette.brown800, // dark text on the cream pill
  accent: brandPalette.blush200, // bright blush — active / small accent on dark
  danger: "#FF7A6E", // brighter red for legibility on dark
  onDanger: "#221109",
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
 * shade — 팔레트 색을 결정적으로 어둡게(f<1)/밝게(f>1) 파생. (파티 게임 월드가 비활성이라 현재
 * 미사용 — API는 유지.) #RRGGBB 입력 전제 순수 함수.
 */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  if (f < 1) {
    r *= f;
    g *= f;
    b *= f;
  } else {
    r += (255 - r) * (f - 1);
    g += (255 - g) * (f - 1);
    b += (255 - b) * (f - 1);
  }
  const c = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

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
// Myeongjo serif (masterpiece headline) lives in `src/lib/serif.ts` — it needs `Platform` from
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
  shadow: { x: 4, y: 5 }, // legacy hard-offset (unused post-redesign)
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
