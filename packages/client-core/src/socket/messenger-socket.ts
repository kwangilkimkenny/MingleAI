import type { NewMessageEvent, ReadEvent, TypingEvent } from "@mingle/shared";

export interface MessengerSocketHandlers {
  onMessage?: (e: NewMessageEvent) => void;
  onRead?: (e: ReadEvent) => void;
  onTyping?: (e: TypingEvent) => void;
  onError?: (e: unknown) => void;
  /** Called after auto-rejoin on socket reconnect. Use to refetch history to fill any gap. */
  onReconnect?: () => void;
}

export interface MessengerSocketHandle {
  joinRoom(roomId: string): void;
  leaveRoom(roomId: string): void;
  setTyping(roomId: string, isTyping: boolean): void;
  disconnect(): void;
}

/** `ioFactory` is `socket.io-client`'s `io` (injected by the platform). */
export function connectMessengerSocket(opts: {
  ioFactory: (url: string, options: unknown) => any;
  baseUrl: string;
  token: string;
  handlers: MessengerSocketHandlers;
}): MessengerSocketHandle {
  const socket = opts.ioFactory(opts.baseUrl, { auth: { token: opts.token }, transports: ["websocket"] });
  const { onMessage, onRead, onTyping, onError, onReconnect } = opts.handlers;

  // Track joined rooms so we can re-join automatically after a transient disconnect.
  const joinedRooms = new Set<string>();
  let firstConnect = true;

  if (onMessage) socket.on("message:new", onMessage);
  if (onRead) socket.on("message:read", onRead);
  if (onTyping) socket.on("typing", onTyping);
  if (onError) socket.on("messenger:error", onError);

  // socket.io fires "connect" on every (re)connection; skip the very first so we
  // don't double-join on initial connect (joinRoom already emits room:join).
  socket.on("connect", () => {
    if (firstConnect) {
      firstConnect = false;
      return;
    }
    for (const roomId of joinedRooms) {
      socket.emit("room:join", { roomId });
    }
    onReconnect?.();
  });

  return {
    joinRoom: (roomId) => {
      joinedRooms.add(roomId);
      socket.emit("room:join", { roomId });
    },
    leaveRoom: (roomId) => {
      joinedRooms.delete(roomId);
      socket.emit("room:leave", { roomId });
    },
    setTyping: (roomId, isTyping) => socket.emit(isTyping ? "typing:start" : "typing:stop", { roomId }),
    disconnect: () => socket.disconnect(),
  };
}
