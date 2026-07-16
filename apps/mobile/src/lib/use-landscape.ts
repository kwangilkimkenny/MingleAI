import { useEffect } from "react";
import * as ScreenOrientation from "expo-screen-orientation";

/**
 * 화면이 살아있는 동안 가로 고정, 벗어나면 세로 복귀.
 * 실패(웹 등 미지원)는 무시 — 레이아웃은 flex 기반이라 세로에서도 동작한다.
 */
export function useLandscapeLock() {
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);
}
