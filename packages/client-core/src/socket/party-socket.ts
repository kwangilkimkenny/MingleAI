import type { PartyMessageView, PartyMove, PartyPresence, GameChoice, GameStateEvent } from "@mingle/shared";

export interface PartySocketHandlers {
  onMessage?: (e: PartyMessageView) => void;
  onPresence?: (e: PartyPresence) => void;
  onMoved?: (e: PartyMove) => void;
  onError?: (e: unknown) => void;
  /** Called after auto-rejoin on socket reconnect. Use to refetch history to fill any gap. */
  onReconnect?: () => void;
  onGameState?: (e: GameStateEvent) => void;
}

export interface PartySocketHandle {
  joinParty(partyId: string): void;
  leaveParty(partyId: string): void;
  sendChat(partyId: string, content: string): void;
  move(partyId: string, x: number, y: number): void;
  startGame(partyId: string): void;
  voteGame(partyId: string, choice: GameChoice): void;
  syncGame(partyId: string): void;
  endGame(partyId: string): void;
  disconnect(): void;
}

/** `ioFactory` is `socket.io-client`'s `io` (injected by the platform). */
export function connectPartySocket(opts: {
  ioFactory: (url: string, options: unknown) => any;
  baseUrl: string;
  token: string;
  handlers: PartySocketHandlers;
}): PartySocketHandle {
  const socket = opts.ioFactory(opts.baseUrl, {
    auth: { token: opts.token },
    transports: ["websocket"],
  });
  const { onMessage, onPresence, onMoved, onError, onReconnect, onGameState } = opts.handlers;

  // Track joined parties so we can re-join automatically after a transient disconnect.
  const joinedParties = new Set<string>();
  let firstConnect = true;

  if (onMessage) socket.on("party:message", onMessage);
  if (onPresence) socket.on("party:presence", onPresence);
  if (onMoved) socket.on("party:moved", onMoved);
  if (onError) socket.on("error", onError);
  if (onGameState) socket.on("game:state", onGameState);

  // socket.io fires "connect" on every (re)connection; skip the very first so we
  // don't double-join on initial connect (joinParty already emits party:join).
  socket.on("connect", () => {
    if (firstConnect) {
      firstConnect = false;
      return;
    }
    for (const partyId of joinedParties) {
      socket.emit("party:join", { partyId });
    }
    onReconnect?.();
  });

  return {
    joinParty: (partyId) => {
      joinedParties.add(partyId);
      socket.emit("party:join", { partyId });
    },
    leaveParty: (partyId) => {
      joinedParties.delete(partyId);
      socket.emit("party:leave", { partyId });
    },
    sendChat: (partyId, content) => socket.emit("party:chat", { partyId, content }),
    move: (partyId, x, y) => socket.emit("party:move", { partyId, x, y }),
    startGame: (partyId) => socket.emit("game:start", { partyId }),
    voteGame: (partyId, choice) => socket.emit("game:vote", { partyId, choice }),
    syncGame: (partyId) => socket.emit("game:sync", { partyId }),
    endGame: (partyId) => socket.emit("game:end", { partyId }),
    disconnect: () => socket.disconnect(),
  };
}
