import type { SpeedDateSnapshotEvent } from "@mingle/shared";

export interface SpeedDateSocketHandlers {
  /** Per-viewer session snapshot (join, sync, choose echo, and every phase transition). */
  onSnapshot?: (e: SpeedDateSnapshotEvent) => void;
  onError?: (e: unknown) => void;
  /** Called after auto-rejoin on socket reconnect. Use to request a fresh snapshot. */
  onReconnect?: () => void;
}

export interface SpeedDateSocketHandle {
  join(sessionId: string): void;
  leave(sessionId: string): void;
  sync(sessionId: string): void;
  /** Toggle a private "keep talking" choice for an opposite-gender partner. */
  choose(sessionId: string, targetProfileId: string, on: boolean): void;
  disconnect(): void;
}

/** `ioFactory` is `socket.io-client`'s `io` (injected by the platform), mirroring party-socket. */
export function connectSpeedDateSocket(opts: {
  ioFactory: (url: string, options: unknown) => any;
  baseUrl: string;
  token: string;
  handlers: SpeedDateSocketHandlers;
}): SpeedDateSocketHandle {
  const socket = opts.ioFactory(opts.baseUrl, {
    auth: { token: opts.token },
    transports: ["websocket"],
  });
  const { onSnapshot, onError, onReconnect } = opts.handlers;

  const joined = new Set<string>();
  let firstConnect = true;

  if (onSnapshot) socket.on("speeddate:snapshot", onSnapshot);
  if (onError) socket.on("speeddate:error", onError);

  socket.on("connect", () => {
    if (firstConnect) {
      firstConnect = false;
      return;
    }
    for (const sessionId of joined) socket.emit("speeddate:join", { sessionId });
    onReconnect?.();
  });

  return {
    join: (sessionId) => {
      joined.add(sessionId);
      socket.emit("speeddate:join", { sessionId });
    },
    leave: (sessionId) => {
      joined.delete(sessionId);
      socket.emit("speeddate:leave", { sessionId });
    },
    sync: (sessionId) => socket.emit("speeddate:sync", { sessionId }),
    choose: (sessionId, targetProfileId, on) =>
      socket.emit("speeddate:choose", { sessionId, targetProfileId, on }),
    disconnect: () => socket.disconnect(),
  };
}
