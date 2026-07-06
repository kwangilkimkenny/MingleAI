import type { NewMessageEvent, ReadEvent, TypingEvent } from "@mingle/shared";

export interface MessengerSocketHandlers {
  onMessage?: (e: NewMessageEvent) => void;
  onRead?: (e: ReadEvent) => void;
  onTyping?: (e: TypingEvent) => void;
  onError?: (e: unknown) => void;
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
  const { onMessage, onRead, onTyping, onError } = opts.handlers;
  if (onMessage) socket.on("message:new", onMessage);
  if (onRead) socket.on("message:read", onRead);
  if (onTyping) socket.on("typing", onTyping);
  if (onError) socket.on("error", onError);
  return {
    joinRoom: (roomId) => socket.emit("room:join", { roomId }),
    leaveRoom: (roomId) => socket.emit("room:leave", { roomId }),
    setTyping: (roomId, isTyping) => socket.emit(isTyping ? "typing:start" : "typing:stop", { roomId }),
    disconnect: () => socket.disconnect(),
  };
}
