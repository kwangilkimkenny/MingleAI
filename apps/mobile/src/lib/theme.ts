/**
 * Romantic-soft palette — warm rose ground, crisp white cards, a love-red action rose, and warm
 * charcoal ink. Single source of truth for mobile colors. 2026-07-23 the app moved from the
 * hand-drawn doodle look (stark white + black wobble borders + Gaegu handwriting) to a
 * dating-conventional soft system (warm ground, soft rose hairlines, rounded shapes, Pretendard).
 * Token NAMES are kept stable so the ~48 consumers shift by value; the doodle-era names
 * (ink/paper/accent/…) now carry soft-romantic values.
 */
export const colors = {
  ink: "#2A2228", // warm charcoal — primary text (softer than pure black)
  paper: "#FFF7F5", // warm rose-tinted page ground (was stark white)
  card: "#FFFFFF", // crisp white card surface (depth against the warm ground)
  heading: "#9F1239", // deep rose — headings / short emphasis
  grayDark: "#5A4A50", // strong warm secondary text
  grayMid: "#6E5A61", // supporting copy — ~5:1 on paper/white, AA for normal text
  grayLight: "#EAD9DD", // rose-tinted dividers
  border: "#F6D8DE", // soft rose hairline — card/button/input outline (was 2px black ink)
  fill: "#FFF0F1", // rose surface fill
  fillDeep: "#FDE4E8", // deeper rose surface
  partyFloor: "#E9E2D6", // (party game world — disabled; legacy value kept)
  partyRoom: "#FFFDF8",
  partyRoomWarm: "#F8F0E6",
  partyRoomRose: "#F8ECEC",
  // Point colors — the one primary CTA per screen, active tab, unread badges, small highlights.
  // #E11D48 (rose) is the dating-standard love-red; white on it passes AA (4.5:1).
  accent: "#E11D48", // action rose — primary CTA / active state
  accentBright: "#FB7185", // salmon — expressive brand moments / illustration
  accentDeep: "#BE123C", // pressed / stronger action rose
  accentSoft: "#FB7185", // salmon — secondary highlight (icons, small pops)
  accentFill: "#FFD9DE", // light rose — small tinted fills / gauges
  onAccent: "#FFFFFF", // text/icons on an accent fill
  success: "#257A55",
  warning: "#9A5D00",
  warningFill: "#FFF0D6",
  // Danger sits in a brick red, deliberately distinct from the rose primary so a destructive
  // action never reads as "just the CTA color".
  danger: "#B3261E",
  dangerFill: "#FDECEA",
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
  // display = Cafe24 Dongdong (brand/display face), used only on the largest titles for character.
  display: { fontFamily: "Cafe24Dongdong_400Regular", fontSize: 28, lineHeight: 36 },
  title: { fontFamily: "Cafe24Dongdong_400Regular", fontSize: 22, lineHeight: 29 },
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
