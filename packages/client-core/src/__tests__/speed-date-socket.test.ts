import { describe, it, expect, vi } from "vitest";
import type { SpeedDateSnapshotEvent } from "@mingle/shared";
import { connectSpeedDateSocket } from "../index.js";

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

function makeHandle(handlers: Parameters<typeof connectSpeedDateSocket>[0]["handlers"] = {}) {
  const { socket, emitted, listeners } = makeSocket();
  const handle = connectSpeedDateSocket({
    ioFactory: vi.fn().mockReturnValue(socket),
    baseUrl: "",
    token: "",
    handlers,
  });
  return { handle, emitted, listeners };
}

describe("connectSpeedDateSocket", () => {
  it("join emits speeddate:join with sessionId", () => {
    const { handle, emitted } = makeHandle();
    handle.join("s1");
    expect(emitted).toContainEqual(["speeddate:join", { sessionId: "s1" }]);
  });

  it("choose emits the target and toggle flag", () => {
    const { handle, emitted } = makeHandle();
    handle.choose("s1", "f2", true);
    expect(emitted).toContainEqual(["speeddate:choose", { sessionId: "s1", targetProfileId: "f2", on: true }]);
  });

  it("sync and leave emit their events", () => {
    const { handle, emitted } = makeHandle();
    handle.sync("s1");
    handle.leave("s1");
    expect(emitted).toContainEqual(["speeddate:sync", { sessionId: "s1" }]);
    expect(emitted).toContainEqual(["speeddate:leave", { sessionId: "s1" }]);
  });

  it("routes snapshot events to onSnapshot", () => {
    const onSnapshot = vi.fn();
    const { listeners } = makeHandle({ onSnapshot });
    const event: SpeedDateSnapshotEvent = { sessionId: "s1", snapshot: null };
    listeners.get("speeddate:snapshot")?.(event);
    expect(onSnapshot).toHaveBeenCalledWith(event);
  });

  it("re-joins tracked sessions on reconnect (skipping the first connect)", () => {
    const onReconnect = vi.fn();
    const { handle, emitted, listeners } = makeHandle({ onReconnect });
    handle.join("s1");
    listeners.get("connect")?.(undefined); // first connect — no rejoin
    expect(onReconnect).not.toHaveBeenCalled();
    listeners.get("connect")?.(undefined); // reconnect — rejoin + callback
    expect(emitted.filter((e) => e[0] === "speeddate:join")).toHaveLength(2);
    expect(onReconnect).toHaveBeenCalled();
  });
});
