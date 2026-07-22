import { describe, expect, it } from "vitest";
import type { AmongTaskView } from "@mingle/shared";
import { guideToTask, nearestPendingTask } from "../task-guidance";

function task(id: string, x: number, y: number, done = false): AmongTaskView {
  return { taskId: id, kind: "wires", x, y, done };
}

describe("task guidance", () => {
  it("uses the world aspect ratio when choosing the nearest task", () => {
    const nearest = nearestPendingTask(
      { x: 0.5, y: 0.5 },
      [task("wide", 0.7, 0.5), task("down", 0.5, 0.8), task("done", 0.5, 0.51, true)],
    );
    expect(nearest?.task.taskId).toBe("down");
    expect(nearest?.direction).toBe("아래");
  });

  it("returns a readable diagonal direction and proximity band", () => {
    const guidance = guideToTask({ x: 0.5, y: 0.5 }, task("t", 0.52, 0.46));
    expect(guidance.direction).toBe("오른쪽 위");
    expect(guidance.distanceLabel).toBe("가까움");
    expect(guidance.rotationDeg).toBeLessThan(90);
  });

  it("returns null when every task is complete", () => {
    expect(nearestPendingTask({ x: 0, y: 0 }, [task("done", 0.1, 0.1, true)])).toBeNull();
  });
});
