import { Platform } from "react-native";

/**
 * Myeongjo serif family for the masterpiece hero headline (the ONE serif in the app). System
 * fallback for now — iOS/macOS AppleMyungjo, Android Noto Serif CJK. Bundle a Cafe24 serif into
 * `assets/fonts/cafe24` + register it in `app/_layout.tsx` `useFonts`, then swap this one value to
 * that family name (e.g. "Cafe24Classictype").
 *
 * Kept in its own module (not `theme.ts`) because it imports `Platform` from react-native, whose
 * Flow-typed source the pure-lib Vitest cannot parse — no pure-lib test imports this file.
 */
export const serifFont = Platform.select({
  ios: "AppleMyungjo",
  android: "serif",
  web: 'AppleMyungjo, "Nanum Myeongjo", Georgia, "Times New Roman", serif',
  default: "serif",
}) as string;
