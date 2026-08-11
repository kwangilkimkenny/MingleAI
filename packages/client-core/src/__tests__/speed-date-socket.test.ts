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

  it("re-joins tracked sessions on every connect, but calls onReconnect only on a re-connect", () => {
    const onReconnect = vi.fn();
    const { handle, emitted, listeners } = makeHandle({ onReconnect });
    handle.join("s1"); // 1st emit (소켓이 아직 안 붙었을 수도 있다)
    listeners.get("connect")?.(undefined); // 첫 성공 연결 — 재조인은 하되 히스토리 콜백은 없다
    expect(emitted.filter((e) => e[0] === "speeddate:join")).toHaveLength(2);
    expect(onReconnect).not.toHaveBeenCalled();
    listeners.get("connect")?.(undefined); // 재연결 — 재조인 + 콜백
    expect(emitted.filter((e) => e[0] === "speeddate:join")).toHaveLength(3);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  // 2026-08-11: 만료 토큰으로 시작하면 첫 핸드셰이크가 실패한다. 그때 join emit은 허공에 사라지는데,
  // 예전 코드는 첫 성공 연결을 "초기 연결"로 보고 건너뛰어 세션에 영영 못 들어갔다.
  it("joins after a failed first handshake (join emitted before the socket was up)", () => {
    const { handle, emitted, listeners } = makeHandle();
    handle.join("s1"); // 연결 전 — 서버에 닿지 않는다
    emitted.length = 0;
    listeners.get("connect")?.(undefined); // refresh 후 처음으로 붙었다
    expect(emitted).toContainEqual(["speeddate:join", { sessionId: "s1" }]);
  });
});
