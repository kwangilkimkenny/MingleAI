import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../api/client.js";
import { getPartyMessages, connectPartySocket } from "../index.js";

const fetchMock = vi.spyOn(client, "apiFetch").mockResolvedValue(undefined as never);
beforeEach(() => fetchMock.mockClear());

describe("getPartyMessages", () => {
  it("GETs the party message history", async () => {
    await getPartyMessages("pt1");
    expect(fetchMock).toHaveBeenCalledWith("/parties/pt1/messages");
  });
});

describe("connectPartySocket", () => {
  it("connects with websocket transport + token auth", () => {
    const mockSocket = { on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
    const factory = vi.fn().mockReturnValue(mockSocket);
    connectPartySocket({ ioFactory: factory, baseUrl: "http://x", token: "tok", handlers: {} });
    expect(factory).toHaveBeenCalledWith("http://x", {
      auth: { token: "tok" },
      transports: ["websocket"],
    });
  });

  it("emits party:join / party:leave / party:chat / party:move with correct payloads", () => {
    const emitted: unknown[][] = [];
    const mockSocket = { on: vi.fn(), emit: (...a: unknown[]) => emitted.push(a), disconnect: vi.fn() };
    const handle = connectPartySocket({
      ioFactory: vi.fn().mockReturnValue(mockSocket),
      baseUrl: "",
      token: "",
      handlers: {},
    });
    handle.joinParty("pt1");
    handle.sendChat("pt1", "hello");
    handle.move("pt1", 3, 4);
    handle.leaveParty("pt1");
    expect(emitted).toEqual([
      ["party:join", { partyId: "pt1" }],
      ["party:chat", { partyId: "pt1", content: "hello" }],
      ["party:move", { partyId: "pt1", x: 3, y: 4 }],
      ["party:leave", { partyId: "pt1" }],
    ]);
  });

  it("wires handlers to party:message / party:presence / party:moved / error", () => {
    const listeners = new Map<string, (e: unknown) => void>();
    const mockSocket = {
      on: (ev: string, fn: (e: unknown) => void) => listeners.set(ev, fn),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };
    const onMessage = vi.fn();
    const onPresence = vi.fn();
    const onMoved = vi.fn();
    connectPartySocket({
      ioFactory: vi.fn().mockReturnValue(mockSocket),
      baseUrl: "",
      token: "",
      handlers: { onMessage, onPresence, onMoved },
    });
    listeners.get("party:message")!({ id: "m1" });
    listeners.get("party:presence")!({ partyId: "pt1", members: ["pf1"] });
    listeners.get("party:moved")!({ profileId: "pf1", x: 1, y: 2 });
    expect(onMessage).toHaveBeenCalledWith({ id: "m1" });
    expect(onPresence).toHaveBeenCalledWith({ partyId: "pt1", members: ["pf1"] });
    expect(onMoved).toHaveBeenCalledWith({ profileId: "pf1", x: 1, y: 2 });
  });

  it("re-joins tracked parties after a reconnect (second connect event)", () => {
    const emitted: unknown[][] = [];
    let connectCb: (() => void) | undefined;
    const mockSocket = {
      on: (ev: string, fn: () => void) => {
        if (ev === "connect") connectCb = fn;
      },
      emit: (...a: unknown[]) => emitted.push(a),
      disconnect: vi.fn(),
    };
    const onReconnect = vi.fn();
    const handle = connectPartySocket({
      ioFactory: vi.fn().mockReturnValue(mockSocket),
      baseUrl: "",
      token: "",
      handlers: { onReconnect },
    });
    handle.joinParty("pt1");
    connectCb!(); // first connect — skipped
    expect(onReconnect).not.toHaveBeenCalled();
    connectCb!(); // reconnect
    expect(emitted.filter((e) => e[0] === "party:join")).toHaveLength(2);
    expect(onReconnect).toHaveBeenCalled();
  });
});

describe("game events", () => {
  it("emits game:start / game:vote / game:sync / game:end with correct payloads", () => {
    const emitted: unknown[][] = [];
    const mockSocket = { on: vi.fn(), emit: (...a: unknown[]) => emitted.push(a), disconnect: vi.fn() };
    const handle = connectPartySocket({
      ioFactory: vi.fn().mockReturnValue(mockSocket),
      baseUrl: "",
      token: "",
      handlers: {},
    });
    handle.startGame("pt1");
    handle.voteGame("pt1", "a");
    handle.syncGame("pt1");
    handle.endGame("pt1");
    expect(emitted).toEqual([
      ["game:start", { partyId: "pt1" }],
      ["game:vote", { partyId: "pt1", choice: "a" }],
      ["game:sync", { partyId: "pt1" }],
      ["game:end", { partyId: "pt1" }],
    ]);
  });

  it("wires onGameState to game:state", () => {
    const listeners = new Map<string, (e: unknown) => void>();
    const mockSocket = {
      on: (ev: string, fn: (e: unknown) => void) => listeners.set(ev, fn),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };
    const onGameState = vi.fn();
    connectPartySocket({
      ioFactory: vi.fn().mockReturnValue(mockSocket),
      baseUrl: "",
      token: "",
      handlers: { onGameState },
    });
    listeners.get("game:state")!({ partyId: "pt1", snapshot: null });
    expect(onGameState).toHaveBeenCalledWith({ partyId: "pt1", snapshot: null });
  });
});
