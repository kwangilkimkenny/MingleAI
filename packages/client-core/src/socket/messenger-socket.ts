import { attachAuthRefresh, authProvider } from "./socket-auth.js";
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
  const socket = opts.ioFactory(opts.baseUrl, { auth: authProvider(opts.token), transports: ["websocket"] });
  const { onMessage, onRead, onTyping, onError, onReconnect } = opts.handlers;
  // 만료된 액세스 토큰으로 재연결이 영원히 실패하는 것을 막는다.
  attachAuthRefresh(socket);

  // Track joined rooms so we can re-join automatically after a transient disconnect.
  const joinedRooms = new Set<string>();
  let hasConnected = false;

  if (onMessage) socket.on("message:new", onMessage);
  if (onRead) socket.on("message:read", onRead);
  if (onTyping) socket.on("typing", onTyping);
  if (onError) socket.on("messenger:error", onError);

  // 연결될 때마다 추적 중인 방을 다시 조인한다. 서버의 room:join은 멱등(assertMember 후 join)이라
  // 중복 조인은 무해하다. 예전엔 "첫 connect는 건너뛴다"였는데, 만료 토큰으로 시작해 첫 핸드셰이크가
  // 실패하면 그동안 joinRoom으로 보낸 emit이 허공에 사라지고 첫 성공 연결마저 건너뛰어 **방에 영영
  // 들어가지 못했다**(2026-08-11 감사). 히스토리 재조회는 재연결일 때만 부른다.
  socket.on("connect", () => {
    for (const roomId of joinedRooms) {
      socket.emit("room:join", { roomId });
    }
    if (hasConnected) onReconnect?.();
    hasConnected = true;
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
