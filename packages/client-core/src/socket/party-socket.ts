import type {
  PartyMessageView,
  PartyMove,
  PartyPresence,
  GameChoice,
  GameStateEvent,
  AmongStateEvent,
} from "@mingle/shared";

export interface PartySocketHandlers {
  onMessage?: (e: PartyMessageView) => void;
  onPresence?: (e: PartyPresence) => void;
  onMoved?: (e: PartyMove) => void;
  onError?: (e: unknown) => void;
  /** Called after auto-rejoin on socket reconnect. Use to refetch history to fill any gap. */
  onReconnect?: () => void;
  onGameState?: (e: GameStateEvent) => void;
  onAmongState?: (e: AmongStateEvent) => void;
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
  startAmong(partyId: string): void;
  doAmongTask(partyId: string, taskId: string, x: number, y: number): void;
  killAmong(partyId: string, targetProfileId: string, x: number, y: number): void;
  reportAmong(partyId: string, bodyProfileId: string): void;
  emergencyAmong(partyId: string): void;
  voteAmong(partyId: string, target: string): void;
  syncAmong(partyId: string): void;
  endAmong(partyId: string): void;
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
  const { onMessage, onPresence, onMoved, onError, onReconnect, onGameState, onAmongState } =
    opts.handlers;

  // Track joined parties so we can re-join automatically after a transient disconnect.
  const joinedParties = new Set<string>();
  let firstConnect = true;

  if (onMessage) socket.on("party:message", onMessage);
  if (onPresence) socket.on("party:presence", onPresence);
  if (onMoved) socket.on("party:moved", onMoved);
  if (onError) socket.on("party:error", onError);
  if (onGameState) socket.on("game:state", onGameState);
  if (onAmongState) socket.on("among:state", onAmongState);

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
    startAmong: (partyId) => socket.emit("among:start", { partyId }),
    doAmongTask: (partyId, taskId, x, y) => socket.emit("among:task", { partyId, taskId, x, y }),
    killAmong: (partyId, targetProfileId, x, y) =>
      socket.emit("among:kill", { partyId, targetProfileId, x, y }),
    reportAmong: (partyId, bodyProfileId) => socket.emit("among:report", { partyId, bodyProfileId }),
    emergencyAmong: (partyId) => socket.emit("among:emergency", { partyId }),
    voteAmong: (partyId, target) => socket.emit("among:vote", { partyId, targetProfileId: target }),
    syncAmong: (partyId) => socket.emit("among:sync", { partyId }),
    endAmong: (partyId) => socket.emit("among:end", { partyId }),
    disconnect: () => socket.disconnect(),
  };
}
