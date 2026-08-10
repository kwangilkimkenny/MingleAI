import { describe, expect, it } from "vitest";

import {
  speedDateConnectionCopy,
  speedDateFaceFallbackCopy,
  speedDateProgressCopy,
} from "../speed-date-presentation";

describe("speed-date session presentation regression", () => {
  it("distinguishes every media connection state", () => {
    expect(speedDateConnectionCopy("idle")).toBe("미디어 준비 중");
    expect(speedDateConnectionCopy("connecting")).toBe("미디어 연결 중");
    expect(speedDateConnectionCopy("connected")).toBe("연결 안정");
    expect(speedDateConnectionCopy("unavailable")).toBe("미디어 연결 안 됨");
  });

  it("explains why an avatar replaces face video", () => {
    expect(speedDateFaceFallbackCopy("connecting")).toBe("상대 영상을 연결하고 있어요.");
    expect(speedDateFaceFallbackCopy("unavailable")).toBe(
      "영상을 연결할 수 없어 아바타로 대화를 이어가요.",
    );
    expect(speedDateFaceFallbackCopy("connected")).toBe(
      "상대 카메라가 꺼져 있어 아바타로 대화를 이어가요.",
    );
  });

  it("shows progress across the whole three-stage session", () => {
    expect(
      speedDateProgressCopy({ stageIndex: 1, stageCount: 3, roundIndex: 0, roundCount: 3 }),
    ).toBe("단계 2/3 · 대화 4/9");
    expect(
      speedDateProgressCopy({ stageIndex: 2, stageCount: 3, roundIndex: 2, roundCount: 3 }),
    ).toBe("단계 3/3 · 대화 9/9");
  });
});
