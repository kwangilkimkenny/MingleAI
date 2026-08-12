import { Platform } from "react-native";

/**
 * Myeongjo serif family for dark-editorial headings (the ONE serif in the app). System
 * fallback for now — iOS/macOS AppleMyungjo, Android Noto Serif CJK. A bundled serif must be added
 * only with its license, registered in `app/_layout.tsx`, and then referenced through this value.
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
