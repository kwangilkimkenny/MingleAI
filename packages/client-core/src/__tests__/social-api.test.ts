import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendMessage } from "../api/messenger.js";
import { configureClient, setTokenAccessor } from "../config.js";
import { connectMessengerSocket } from "../socket/messenger-socket.js";

describe("social api", () => {
  beforeEach(() => { configureClient({ baseUrl: "http://api.test" }); setTokenAccessor(() => "t"); });
  afterEach(() => vi.unstubAllGlobals());

  it("sendMessage POSTs the room message endpoint", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: "m1", content: "hi" }) } as Response);
    vi.stubGlobal("fetch", f);
    await sendMessage("r1", "hi");
    expect(f.mock.calls[0][0]).toBe("http://api.test/messenger/rooms/r1/messages");
    expect(f.mock.calls[0][1]?.method).toBe("POST");
  });
});

describe("connectMessengerSocket", () => {
  it("passes token via an auth callback, not the query string", () => {
    setTokenAccessor(() => null); // 저장소가 비면 넘겨받은 토큰이 쓰인다
    const mockSocket = { on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
    const factory = vi.fn().mockReturnValue(mockSocket);
    connectMessengerSocket({ ioFactory: factory, baseUrl: "http://x", token: "tok", handlers: {} });
    // auth는 콜백이다 — 재연결마다 최신 토큰을 다시 읽어야 하기 때문(socket-auth.ts).
    const auth = (factory.mock.calls[0][1] as { auth: (cb: (d: unknown) => void) => void }).auth;
    let seen: unknown;
    auth((d) => (seen = d));
    expect(seen).toEqual({ token: "tok" });
    expect(String(factory.mock.calls[0][0])).not.toContain("tok");
  });

  it("emits room:join, typing:start, typing:stop with correct names", () => {
    const emitted: unknown[][] = [];
    const mockSocket = { on: vi.fn(), emit: (...a: unknown[]) => emitted.push(a), disconnect: vi.fn() };
    const handle = connectMessengerSocket({ ioFactory: vi.fn().mockReturnValue(mockSocket), baseUrl: "", token: "", handlers: {} });
    handle.joinRoom("r1");
    handle.setTyping("r1", true);
    handle.setTyping("r1", false);
    expect(emitted[0][0]).toBe("room:join");
    expect(emitted[1][0]).toBe("typing:start");
    expect(emitted[2][0]).toBe("typing:stop");
  });

  it("does not crash when handlers are omitted", () => {
    const mockSocket = { on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
    expect(() =>
      connectMessengerSocket({ ioFactory: vi.fn().mockReturnValue(mockSocket), baseUrl: "", token: "", handlers: {} })
    ).not.toThrow();
  });

  it("re-emits room:join for tracked rooms after reconnect (second connect event)", () => {
    const emitted: unknown[][] = [];
    const socketHandlers = new Map<string, (...args: unknown[]) => void>();
    const mockSocket = {
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        socketHandlers.set(event, fn);
      }),
      emit: (...a: unknown[]) => emitted.push(a),
      disconnect: vi.fn(),
    };
    const handle = connectMessengerSocket({
      ioFactory: vi.fn().mockReturnValue(mockSocket),
      baseUrl: "",
      token: "",
      handlers: {},
    });
    handle.joinRoom("room1");
    // First connect fires — skipped (not treated as reconnect)
    socketHandlers.get("connect")?.();
    emitted.length = 0;
    // Second connect fires — simulates auto-reconnect
    socketHandlers.get("connect")?.();
    expect(emitted).toEqual(expect.arrayContaining([["room:join", { roomId: "room1" }]]));
  });

  it("calls onReconnect handler after auto-rejoin", () => {
    const onReconnect = vi.fn();
    const socketHandlers = new Map<string, (...args: unknown[]) => void>();
    const mockSocket = {
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        socketHandlers.set(event, fn);
      }),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };
    connectMessengerSocket({
      ioFactory: vi.fn().mockReturnValue(mockSocket),
      baseUrl: "",
      token: "",
      handlers: { onReconnect },
    });
    // First connect (ignored)
    socketHandlers.get("connect")?.();
    expect(onReconnect).not.toHaveBeenCalled();
    // Reconnect
    socketHandlers.get("connect")?.();
    expect(onReconnect).toHaveBeenCalledOnce();
  });
});
