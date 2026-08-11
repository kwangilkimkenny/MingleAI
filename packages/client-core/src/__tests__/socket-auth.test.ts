import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureClient, connectMessengerSocket, setTokenAccessor } from "../index.js";

/** connect/connect_error 리스너를 붙잡아 직접 발화시킬 수 있는 소켓 목. */
function makeSocket() {
  const listeners = new Map<string, ((arg?: unknown) => void)[]>();
  const emitted: unknown[][] = [];
  const socket = {
    on: (ev: string, fn: (arg?: unknown) => void) => {
      const list = listeners.get(ev) ?? [];
      list.push(fn);
      listeners.set(ev, list);
    },
    emit: (...a: unknown[]) => emitted.push(a),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const fire = (ev: string, arg?: unknown) => listeners.get(ev)?.forEach((fn) => fn(arg));
  return { socket, fire, emitted };
}

function connect(token = "t0") {
  const { socket, fire, emitted } = makeSocket();
  const ioFactory = vi.fn().mockReturnValue(socket);
  const handle = connectMessengerSocket({ ioFactory, baseUrl: "", token, handlers: {} });
  return { socket, fire, emitted, ioFactory, handle };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("socket auth", () => {
  beforeEach(() => {
    setTokenAccessor(() => null);
    configureClient({ baseUrl: "" });
  });

  it("hands socket.io an auth callback that reads the freshest token on every (re)connect", () => {
    let stored = "first";
    setTokenAccessor(() => stored);
    const { ioFactory } = connect("fallback");

    const auth = (ioFactory.mock.calls[0][1] as { auth: (cb: (d: unknown) => void) => void }).auth;
    const seen: unknown[] = [];
    auth((d) => seen.push(d));
    stored = "rotated";
    auth((d) => seen.push(d));

    expect(seen).toEqual([{ token: "first" }, { token: "rotated" }]);
  });

  it("falls back to the token passed in when the store is empty", () => {
    const { ioFactory } = connect("fallback");
    const auth = (ioFactory.mock.calls[0][1] as { auth: (cb: (d: unknown) => void) => void }).auth;
    let seen: unknown;
    auth((d) => (seen = d));
    expect(seen).toEqual({ token: "fallback" });
  });

  // 감사 2026-08-11: 만료 토큰을 든 소켓이 unauthorized로 무한 재시도하며 조용히 죽었다.
  it("refreshes once and reconnects when the handshake says unauthorized", async () => {
    const refreshAccessToken = vi.fn().mockResolvedValue("new-token");
    configureClient({ baseUrl: "", refreshAccessToken });
    const { socket, fire } = connect();

    fire("connect_error", new Error("unauthorized"));
    await flush();

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it("ignores plain network errors — socket.io's own retry handles those", async () => {
    const refreshAccessToken = vi.fn();
    configureClient({ baseUrl: "", refreshAccessToken });
    const { socket, fire } = connect();

    fire("connect_error", new Error("xhr poll error"));
    await flush();

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(socket.connect).not.toHaveBeenCalled();
  });

  it("logs out instead of looping when refresh keeps failing", async () => {
    const onUnauthorized = vi.fn();
    const refreshAccessToken = vi.fn().mockResolvedValue("still-rejected");
    configureClient({ baseUrl: "", onUnauthorized, refreshAccessToken });
    const { fire } = connect();

    for (let i = 0; i < 5; i++) {
      fire("connect_error", new Error("unauthorized"));
      await flush();
    }

    expect(refreshAccessToken).toHaveBeenCalledTimes(3); // MAX_REFRESH_ATTEMPTS
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it("logs out when there is no refresh token to spend", async () => {
    const onUnauthorized = vi.fn();
    configureClient({ baseUrl: "", onUnauthorized });
    const { fire } = connect();

    fire("connect_error", new Error("unauthorized"));
    await flush();

    expect(onUnauthorized).toHaveBeenCalled();
  });

  it("resets the attempt budget after a successful connect", async () => {
    const refreshAccessToken = vi.fn().mockResolvedValue("new-token");
    configureClient({ baseUrl: "", refreshAccessToken });
    const { fire } = connect();

    for (let i = 0; i < 3; i++) {
      fire("connect_error", new Error("unauthorized"));
      await flush();
    }
    fire("connect");
    fire("connect_error", new Error("unauthorized"));
    await flush();

    expect(refreshAccessToken).toHaveBeenCalledTimes(4);
  });
});
