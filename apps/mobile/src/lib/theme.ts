/**
 * Doodle palette — ink line-art on a white ground, with a contrast-safe action coral,
 * expressive coral highlights, and warm taupe. Single source of truth for mobile colors.
 * Hierarchy still comes from ink/contrast; color stays a sparing semantic accent.
 */
export const colors = {
  ink: "#17150F", // primary text / ink; also inverted-block fills
  paper: "#FFFFFF", // page background / text on inverted blocks
  grayDark: "#736357", // warm taupe — strong secondary text (point-palette neutral)
  grayMid: "#786F67", // muted text; 4.9:1 on paper, safe for normal-size supporting copy
  grayLight: "#D9D5CC", // borders / dividers
  fill: "#F1EFE9", // subtle surface fill
  fillDeep: "#E7E4DC", // deeper surface fill
  partyFloor: "#E9E2D6", // warm paper-board ground behind rooms
  partyRoom: "#FFFDF8", // primary room paper
  partyRoomWarm: "#F8F0E6", // quiet room distinction without new semantic color
  partyRoomRose: "#F8ECEC", // restrained social-zone tint
  // Point colors — used sparingly for emphasis only: the one primary CTA per screen,
  // the active tab, unread badges, small highlights. Everything else stays ink-on-white.
  // #FF5864 is retained as the expressive brand coral, while interactive fills use the
  // darker, WCAG-safe action coral. White on accent is 4.6:1 (normal text AA).
  accent: "#D13F4F", // action coral — primary CTA / active state
  accentBright: "#FF5864", // expressive coral — illustration and large decorative moments
  accentDeep: "#A92F3D", // pressed / stronger action coral
  accentSoft: "#FF8276", // salmon — secondary highlight (icons, small pops)
  accentFill: "#FF9F9D", // light salmon — small tinted fills / gauges
  onAccent: "#FFFFFF", // text/icons on an accent fill
  success: "#257A55",
  warning: "#9A5D00",
  warningFill: "#FFF0D6",
  // Danger deliberately sits in a deeper burgundy family than the action coral. Use the
  // outline/icon treatment for warnings and reserve the solid fill for a final confirmation.
  danger: "#7B2531",
  dangerFill: "#F7E7EA",
} as const;

/**
 * Production layout primitives. Screens may compose these tokens, but should not invent
 * one-off spacing or undersized controls. The 4pt base grid keeps dense game HUDs and calm
 * social screens visually related.
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
  display: { fontFamily: "Gaegu_700Bold", fontSize: 30, lineHeight: 36 },
  title: { fontFamily: "Gaegu_700Bold", fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: "Gaegu_700Bold", fontSize: 20, lineHeight: 26 },
  body: { fontFamily: "Pretendard_400Regular", fontSize: 16, lineHeight: 24 },
  label: { fontFamily: "Pretendard_600SemiBold", fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: "Pretendard_400Regular", fontSize: 13, lineHeight: 19 },
} as const;

export const control = {
  minTouch: 44,
  buttonHeight: 48,
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
 * shade — 팔레트 색을 결정적으로 어둡게(f<1)/밝게(f>1) 파생. 두들 월드의 종이·잉크
 * 가구 명암에 사용. 팔레트를 벗어난 새 색을
 * 도입하지 않고 기존 토큰에서 명암만 파생하기 위한 순수 함수(#RRGGBB 입력 전제).
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
 * Type roles. Display = Gaegu (Korean handwriting) for the brand wordmark, headings, and short
 * CTA copy — the hand-drawn character the doodle system is built around. Body uses bundled
 * Pretendard (legible for long/small Korean text; never set Gaegu below 18px). Loaded in app/_layout.
 */
export const fonts = {
  display: "Gaegu_700Bold",
  displayRegular: "Gaegu_400Regular",
  body: "Pretendard_400Regular",
  bodySemibold: "Pretendard_600SemiBold",
} as const;

/**
 * Doodle surface tokens — the hand-drawn "sketchbook" look in warm ink and paper, re-expressed
 * for React Native (no SVG/feTurbulence, no new deps). The doodle character comes from:
 *  1. wonky per-corner border-radius (asymmetric),
 *  2. a solid offset shadow with NO blur (an ink layer translated behind the surface),
 *  3. a slight rotation on select surfaces.
 * Primary actions use the semantic action coral; neutral emphasis may use an inverted ink block.
 */
export const doodle = {
  border: 2, // ink stroke width
  shadow: { x: 4, y: 5 }, // hard offset "sticker" shadow, no blur (mirrors 4px 5px 0 #17150F)
  // Wonky per-corner radii — deliberately asymmetric so edges read as hand-drawn.
  radius: {
    button: {
      borderTopLeftRadius: 13,
      borderTopRightRadius: 9,
      borderBottomRightRadius: 15,
      borderBottomLeftRadius: 7,
    },
    card: {
      borderTopLeftRadius: 18,
      borderTopRightRadius: 10,
      borderBottomRightRadius: 20,
      borderBottomLeftRadius: 12,
    },
    input: {
      borderTopLeftRadius: 11,
      borderTopRightRadius: 8,
      borderBottomRightRadius: 13,
      borderBottomLeftRadius: 9,
    },
    chip: {
      borderTopLeftRadius: 10,
      borderTopRightRadius: 7,
      borderBottomRightRadius: 11,
      borderBottomLeftRadius: 8,
    },
  },
} as const;

/**
 * Shared doodle navigation-header options — paper ground, bold ink title, a solid ink
 * underline (no soft shadow), so every screen reads like a page from the same sketchbook.
 * Spread into a Stack's screenOptions.
 */
export const doodleHeaderOptions = {
  headerStyle: {
    backgroundColor: colors.paper,
    borderBottomWidth: doodle.border,
    borderBottomColor: colors.ink,
  },
  headerTitleStyle: { color: colors.ink, fontFamily: fonts.display, fontSize: 22 },
  headerTintColor: colors.ink,
  headerShadowVisible: false,
};
