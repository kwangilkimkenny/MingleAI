import { WORLD_ASPECT } from "@mingle/shared";

export interface WorldFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 컨테이너에 aspect-fit(레터박스)한 월드 프레임. 픽셀 스케일이 등방이 된다. (구 로비 뷰) */
export function worldFrame(
  containerW: number,
  containerH: number,
  aspect: number = WORLD_ASPECT,
): WorldFrame {
  if (containerW <= 0 || containerH <= 0) return { left: 0, top: 0, width: 0, height: 0 };
  let width = containerW;
  let height = containerW / aspect;
  if (height > containerH) {
    height = containerH;
    width = containerH * aspect;
  }
  return { left: (containerW - width) / 2, top: (containerH - height) / 2, width, height };
}

export interface WorldCamera {
  /** 렌더될 월드 픽셀 크기(뷰포트보다 큼). */
  worldW: number;
  worldH: number;
  /** 월드를 (-offsetX, -offsetY)만큼 이동해 focus를 화면 중앙에 둔다(가장자리 clamp). */
  offsetX: number;
  offsetY: number;
  /** world-y 1단위당 픽셀(= worldH). 캐릭터 크기 산출에 사용. */
  scale: number;
}

/** 뷰포트보다 큰 월드를 그리고 focus(내 캐릭터, 정규화 좌표)를 중앙에 두는 스크롤 카메라.
 *  OVERSCAN>1 이라 aspect가 넓으면 항상 두 축 모두 스크롤 여지가 생긴다. focus 없으면 중앙. */
export function worldCamera(
  viewW: number,
  viewH: number,
  focus: { x: number; y: number } | null,
  aspect: number = WORLD_ASPECT,
): WorldCamera {
  if (viewW <= 0 || viewH <= 0) return { worldW: 0, worldH: 0, offsetX: 0, offsetY: 0, scale: 0 };
  const OVERSCAN = 1.25;
  const scale = Math.max(viewH, viewW / aspect) * OVERSCAN;
  const worldH = scale;
  const worldW = scale * aspect;
  const fx = focus ? focus.x : 0.5;
  const fy = focus ? focus.y : 0.5;
  // 월드가 뷰포트보다 작으면 중앙 정렬(음수 offset 허용), 크면 [0, world-view]로 clamp.
  const clampAxis = (want: number, world: number, view: number) => {
    if (world <= view) return (world - view) / 2;
    return Math.min(Math.max(want, 0), world - view);
  };
  return {
    worldW,
    worldH,
    offsetX: clampAxis(fx * worldW - viewW / 2, worldW, viewW),
    offsetY: clampAxis(fy * worldH - viewH / 2, worldH, viewH),
    scale,
  };
}
