/**
 * Line-art palette — warm off-white paper, crisp white cards, thin ink strokes, and a single
 * persimmon-coral point color. Single source of truth for mobile colors. 2026-07-24 the app moved
 * from the soft-romantic rose system back to the doodle identity, evolved into a refined thin-line
 * line-art look (clean hairlines, outline-first elevation, no wobble, one accent). Aesthetic rule:
 * outline-first, shadow-minimal, color = coral in one or two spots. Token NAMES are kept stable so
 * the ~48 consumers shift by value; the doodle/rose-era names now carry line-art values.
 *
 * ⚠️ accent (#FF4D3D) fails AA for white TEXT (3.29:1) — it is for strokes/icons/active/tint only.
 * White text on a coral surface (buttons, badges) MUST use accentStrong (#D6361F, 4.77:1). danger is
 * a cool crimson, deliberately hue-separated from the warm coral so destructive ≠ "just the CTA".
 */
export const colors = {
  ink: "#181514", // 먹선·본문 (따뜻 니어블랙)
  paper: "#FBFAF8", // 페이지 그라운드 (살짝 웜 오프화이트)
  card: "#FFFFFF", // 카드 서피스
  heading: "#181514", // 라인아트 = 타이틀도 잉크 (색 강조는 코랄 1점만)
  grayDark: "#57534E", // 보조 텍스트 (AA)
  grayMid: "#78716C", // 캡션·비활성 (white/paper 위 AA)
  grayLight: "#E8E5E0", // = line 값 (divider) — 이름 유지
  line: "#E8E5E0", // 헤어라인 divider·행 구분
  border: "#E0DBD3", // = outline 값 (카드·인풋 외곽) — 이름 유지
  outline: "#E0DBD3", // 카드·인풋 외곽선 (신규 별칭)
  fill: "#F4F2EF", // 중립 연회색 fill (disabled 버튼·notice bg)
  fillDeep: "#ECE9E4", // 더 진한 중립 fill
  partyFloor: "#E9E2D6", // (party game world — disabled; legacy value kept)
  partyRoom: "#FFFDF8",
  partyRoomWarm: "#F8F0E6",
  partyRoomRose: "#F8ECEC",
  // Point color — the single coral used per screen. accent = strokes/icons/active/tint (NO white
  // text). accentStrong = coral surfaces carrying white text (buttons, badges).
  accent: "#FF4D3D", // 브랜드 코랄 — 선·아이콘·활성탭·틴트 전용 (흰글씨 X)
  accentBright: "#FF6F5E", // 밝은 코랄 — 일러스트·표현
  accentDeep: "#B92E1A", // pressed (레거시 이름 유지)
  accentPressed: "#B92E1A", // 눌림 (신규 별칭)
  accentSoft: "#FF6F5E", // 밝은 코랄 보조
  accentStrong: "#D6361F", // 흰글씨 얹는 코랄 fill (버튼·배지) — white 4.77:1 AA
  accentFill: "#FFE7E3", // 연코랄 틴트 (hero 배경·pressed)
  onAccent: "#FFFFFF", // 코랄 위 글씨
  success: "#257A55",
  warning: "#9A5D00",
  warningFill: "#FFF0D6",
  // Cool crimson — hue-separated from the warm coral so a destructive action never reads as the CTA.
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
  // Pretendard 단일 (2026-07-24 Cafe24Dongdong 폐기 — 라인아트는 클린 모던, 계층은 크기+웨이트+코랄).
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

/**
 * Soft elevation — blurred, low-opacity shadows in a warm rose-brown (replaces the doodle era's
 * hard offset ink "sticker" shadow). Spread onto card/sheet/hero surfaces.
 */
export const shadow = {
  card: {
    shadowColor: "#7A2A3A",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  elevated: {
    shadowColor: "#7A2A3A",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;

/**
 * Surface tokens — rounded corners + soft rose hairline. `radius` keeps the four-corner shape
 * (WonkyRadius) the primitives expect, but every corner is equal now (clean rounded, no wobble).
 * `border` is the hairline width; `shadow` (legacy hard offset) is retained for API stability but
 * unused — surfaces use the blurred `shadow` export above.
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
