import { WORLD_ASPECT } from "@mingle/shared";

export interface WorldFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 컨테이너에 aspect-fit(레터박스)한 월드 프레임. 픽셀 스케일이 등방이 된다. */
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
