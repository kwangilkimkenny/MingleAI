import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";

/**
 * 화면이 포커스인 동안 가로 고정, 블러/이탈 시 세로 복귀.
 * useFocusEffect라서 위에 다른 화면이 push되면(신고 등) 즉시 세로로 돌아온다.
 * 실패(웹 등 미지원)는 무시 — 레이아웃은 flex 기반이라 세로에서도 동작한다.
 */
export function useLandscapeLock() {
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, []),
  );
}
