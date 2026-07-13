/**
 * Doodle B&W palette — pure black & white, ZERO chroma. Single source of truth for mobile colors,
 * mirroring apps/web/design/DESIGN.md. Hierarchy comes from ink/gray/fill contrast, never hue.
 */
export const colors = {
  ink: "#17150F", // primary text / ink; also inverted-block fills
  paper: "#FFFFFF", // page background / text on inverted blocks
  grayDark: "#45413A", // strong secondary text
  grayMid: "#8A857C", // muted / subtitle text
  grayLight: "#D9D5CC", // borders / dividers
  fill: "#F1EFE9", // subtle surface fill
  fillDeep: "#E7E4DC", // deeper surface fill
} as const;

/**
 * Doodle surface tokens — the hand-drawn "sketchbook" look in pure B&W, re-expressed
 * for React Native (no SVG/feTurbulence, no new deps). The doodle character comes from:
 *  1. wonky per-corner border-radius (asymmetric),
 *  2. a solid offset shadow with NO blur (an ink layer translated behind the surface),
 *  3. a slight rotation on select surfaces.
 * Emphasis is an inverted ink block with paper text — never color.
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
  headerTitleStyle: { color: colors.ink, fontWeight: "800" as const, fontSize: 20 },
  headerTintColor: colors.ink,
  headerShadowVisible: false,
};
