import { attachAuthRefresh, authProvider } from "./socket-auth.js";
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
    auth: authProvider(opts.token),
    transports: ["websocket"],
  });
  const { onSnapshot, onError, onReconnect } = opts.handlers;
  // 만료된 액세스 토큰으로 재연결이 영원히 실패하는 것을 막는다.
  attachAuthRefresh(socket);

  const joined = new Set<string>();
  let hasConnected = false;

  if (onSnapshot) socket.on("speeddate:snapshot", onSnapshot);
  if (onError) socket.on("speeddate:error", onError);

  // 연결될 때마다 재조인 — 첫 핸드셰이크가 만료 토큰으로 실패한 경우에도 세션에 들어간다
  // (messenger-socket의 같은 주석 참조). 스냅샷 재요청은 재연결일 때만.
  socket.on("connect", () => {
    for (const sessionId of joined) socket.emit("speeddate:join", { sessionId });
    if (hasConnected) onReconnect?.();
    hasConnected = true;
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
