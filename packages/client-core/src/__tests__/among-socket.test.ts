import { describe, it, expect, vi } from "vitest";
import type { AmongStateEvent } from "@mingle/shared";
import { connectPartySocket } from "../index.js";

function makeSocket() {
  const emitted: unknown[][] = [];
  const listeners = new Map<string, (e: unknown) => void>();
  return {
    socket: {
      on: (ev: string, fn: (e: unknown) => void) => listeners.set(ev, fn),
      emit: (...a: unknown[]) => emitted.push(a),
      disconnect: vi.fn(),
    },
    emitted,
    listeners,
  };
}

function makeHandle(overrideHandlers: Parameters<typeof connectPartySocket>[0]["handlers"] = {}) {
  const { socket, emitted, listeners } = makeSocket();
  const handle = connectPartySocket({
    ioFactory: vi.fn().mockReturnValue(socket),
    baseUrl: "",
    token: "",
    handlers: overrideHandlers,
  });
  return { handle, emitted, listeners };
}

describe("Among Us emit methods", () => {
  it("startAmong emits among:start with partyId", () => {
    const { handle, emitted } = makeHandle();
    handle.startAmong("p1");
    expect(emitted).toContainEqual(["among:start", { partyId: "p1" }]);
  });

  it("doAmongTask emits among:task with partyId, taskId, x, y", () => {
    const { handle, emitted } = makeHandle();
    handle.doAmongTask("p1", "t1", 0.3, 0.7);
    expect(emitted).toContainEqual(["among:task", { partyId: "p1", taskId: "t1", x: 0.3, y: 0.7 }]);
  });

  it("killAmong emits among:kill with partyId, targetProfileId, x, y", () => {
    const { handle, emitted } = makeHandle();
    handle.killAmong("p1", "victim1", 0.1, 0.9);
    expect(emitted).toContainEqual([
      "among:kill",
      { partyId: "p1", targetProfileId: "victim1", x: 0.1, y: 0.9 },
    ]);
  });

  it("reportAmong emits among:report with partyId, bodyProfileId", () => {
    const { handle, emitted } = makeHandle();
    handle.reportAmong("p1", "body1");
    expect(emitted).toContainEqual(["among:report", { partyId: "p1", bodyProfileId: "body1" }]);
  });

  it("emergencyAmong emits among:emergency with partyId", () => {
    const { handle, emitted } = makeHandle();
    handle.emergencyAmong("p1");
    expect(emitted).toContainEqual(["among:emergency", { partyId: "p1" }]);
  });

  it("voteAmong emits among:vote with partyId and targetProfileId mapped from target param", () => {
    const { handle, emitted } = makeHandle();
    handle.voteAmong("p1", "suspect1");
    expect(emitted).toContainEqual(["among:vote", { partyId: "p1", targetProfileId: "suspect1" }]);
  });

  it("syncAmong emits among:sync with partyId", () => {
    const { handle, emitted } = makeHandle();
    handle.syncAmong("p1");
    expect(emitted).toContainEqual(["among:sync", { partyId: "p1" }]);
  });

  it("endAmong emits among:end with partyId", () => {
    const { handle, emitted } = makeHandle();
    handle.endAmong("p1");
    expect(emitted).toContainEqual(["among:end", { partyId: "p1" }]);
  });
});

describe("onAmongState handler", () => {
  it("wires onAmongState to among:state socket event", () => {
    const onAmongState = vi.fn();
    const { listeners } = makeHandle({ onAmongState });
    const fakeEvent: AmongStateEvent = {
      partyId: "p1",
      snapshot: null,
    };
    listeners.get("among:state")!(fakeEvent);
    expect(onAmongState).toHaveBeenCalledWith(fakeEvent);
  });

  it("does not throw when onAmongState is not provided and among:state fires", () => {
    const { listeners } = makeHandle({});
    // No handler registered means no listener set — but if it were optional-wired, should not throw
    // The implementation only sets the listener when onAmongState is defined,
    // so the listener won't be in the map; this test confirms no crash at connect time.
    expect(listeners.get("among:state")).toBeUndefined();
  });
});
