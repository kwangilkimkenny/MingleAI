import { dark } from "./theme";

/**
 * 읽음 상태는 행 배경의 깊이로만 구분한다.
 * 행 전체 opacity를 낮추면 제목과 본문까지 함께 합성되어 접근성 대비가 무너진다.
 */
export function notificationRowAppearance(read: boolean): { backgroundColor: string } {
  return { backgroundColor: read ? dark.surface : dark.surfaceHi };
}
