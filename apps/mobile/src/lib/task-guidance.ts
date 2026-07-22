import { WORLD_ASPECT, type AmongTaskView } from "@mingle/shared";

export type TaskDirection =
  | "위"
  | "오른쪽 위"
  | "오른쪽"
  | "오른쪽 아래"
  | "아래"
  | "왼쪽 아래"
  | "왼쪽"
  | "왼쪽 위";

export interface TaskGuidance {
  task: AmongTaskView;
  direction: TaskDirection;
  distanceLabel: "가까움" | "조금 멀리" | "멀리";
  distance: number;
  /** Rotation for an upward-pointing arrow in React Native screen coordinates. */
  rotationDeg: number;
}

const DIRECTIONS: TaskDirection[] = [
  "오른쪽",
  "오른쪽 아래",
  "아래",
  "왼쪽 아래",
  "왼쪽",
  "왼쪽 위",
  "위",
  "오른쪽 위",
];

export function guideToTask(
  from: { x: number; y: number },
  task: AmongTaskView,
): TaskGuidance {
  const dx = (task.x - from.x) * WORLD_ASPECT;
  const dy = task.y - from.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const sector = Math.round(angle / (Math.PI / 4));
  const direction = DIRECTIONS[(sector + 8) % 8]!;

  return {
    task,
    direction,
    distanceLabel: distance < 0.14 ? "가까움" : distance < 0.36 ? "조금 멀리" : "멀리",
    distance,
    rotationDeg: (angle * 180) / Math.PI + 90,
  };
}

export function nearestPendingTask(
  from: { x: number; y: number },
  tasks: AmongTaskView[],
): TaskGuidance | null {
  const pending = tasks.filter((task) => !task.done).map((task) => guideToTask(from, task));
  pending.sort((a, b) => a.distance - b.distance);
  return pending[0] ?? null;
}
