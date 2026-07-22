import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  InteractionManager,
  Platform,
  type View,
} from "react-native";

/** Moves VoiceOver/TalkBack focus to the first meaningful element when a modal state appears. */
export function useInitialAccessibilityFocus(active = true) {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!active || Platform.OS === "web") return;
    const task = InteractionManager.runAfterInteractions(() => {
      const tag = findNodeHandle(ref.current);
      if (tag !== null) AccessibilityInfo.setAccessibilityFocus(tag);
    });
    return () => task.cancel();
  }, [active]);

  return ref;
}
