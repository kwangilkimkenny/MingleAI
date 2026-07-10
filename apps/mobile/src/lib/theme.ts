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
