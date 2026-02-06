"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

// 파티 참가자 상태
export interface ParticipantState {
  profileId: string;
  name: string;
  avatarUrl?: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  animation: "idle" | "walking" | "talking" | "waving" | "sitting";
  isTalking: boolean;
  currentMessage?: string;
}

// 테이블 정보
export interface TableState {
  tableId: string;
  position: { x: number; y: number; z: number };
  participantIds: string[];
}

// 파티 상태
export interface PartyState {
  partyId: string;
  status: "waiting" | "running" | "paused" | "completed";
  currentRound: number;
  totalRounds: number;
  participants: ParticipantState[];
  tables: TableState[];
  currentConversation?: {
    tableId: string;
    speakerId: string;
    message: string;
    timestamp: number;
  };
}

// 대화 메시지
export interface ConversationEvent {
  tableId: string;
  speaker: {
    profileId: string;
    name: string;
  };
  message: string;
  emotion?: "happy" | "curious" | "excited" | "thoughtful" | "neutral";
  timestamp: number;
}

// 참가자 이동 이벤트
export interface ParticipantMoveEvent {
  profileId: string;
  targetPosition: { x: number; y: number; z: number };
  duration: number;
}

// 참가자 업데이트 이벤트
export interface ParticipantUpdateEvent {
  profileId: string;
  changes: Partial<ParticipantState>;
}

export function usePartySocket(partyId: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [partyState, setPartyState] = useState<PartyState | null>(null);
  const [conversations, setConversations] = useState<ConversationEvent[]>([]);
  const [systemMessages, setSystemMessages] = useState<string[]>([]);

  const socketRef = useRef<Socket | null>(null);

  // 소켓 연결
  useEffect(() => {
    if (!partyId) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const newSocket = io(`${apiUrl}/party`, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("[PartySocket] Connected");
      setConnected(true);
      newSocket.emit("joinParty", { partyId });
    });

    newSocket.on("disconnect", () => {
      console.log("[PartySocket] Disconnected");
      setConnected(false);
    });

    // 파티 상태 업데이트
    newSocket.on("partyState", (state: PartyState) => {
      console.log("[PartySocket] Party state:", state);
      setPartyState(state);
    });

    // 파티 시작
    newSocket.on("partyStarted", (state: PartyState) => {
      console.log("[PartySocket] Party started:", state);
      setPartyState(state);
      setConversations([]);
      setSystemMessages([]);
    });

    // 라운드 시작
    newSocket.on("roundStart", ({ round, totalRounds }) => {
      console.log(`[PartySocket] Round ${round}/${totalRounds} started`);
      setSystemMessages((prev) => [
        ...prev,
        `🎉 라운드 ${round}/${totalRounds} 시작!`,
      ]);
    });

    // 라운드 종료
    newSocket.on("roundEnd", ({ round }) => {
      console.log(`[PartySocket] Round ${round} ended`);
      setSystemMessages((prev) => [...prev, `✅ 라운드 ${round} 종료`]);
    });

    // 대화
    newSocket.on("conversation", (event: ConversationEvent) => {
      console.log("[PartySocket] Conversation:", event);
      setConversations((prev) => [...prev.slice(-20), event]); // 최근 20개만 유지
    });

    // 시스템 메시지
    newSocket.on("systemMessage", ({ message }) => {
      setSystemMessages((prev) => [...prev.slice(-10), message]);
    });

    // 참가자 이동
    newSocket.on("participantMove", (event: ParticipantMoveEvent) => {
      setPartyState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.profileId === event.profileId
              ? { ...p, animation: "walking" as const }
              : p
          ),
        };
      });

      // 이동 완료 후 위치 업데이트 (프론트에서 보간)
      setTimeout(() => {
        setPartyState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            participants: prev.participants.map((p) =>
              p.profileId === event.profileId
                ? { ...p, position: event.targetPosition, animation: "idle" as const }
                : p
            ),
          };
        });
      }, event.duration);
    });

    // 참가자 업데이트
    newSocket.on("participantUpdate", (event: ParticipantUpdateEvent) => {
      setPartyState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.profileId === event.profileId ? { ...p, ...event.changes } : p
          ),
        };
      });
    });

    // 파티 완료
    newSocket.on("partyCompleted", (state: PartyState) => {
      console.log("[PartySocket] Party completed");
      setPartyState(state);
      setSystemMessages((prev) => [...prev, "🎊 파티가 종료되었습니다!"]);
    });

    return () => {
      newSocket.emit("leaveParty", { partyId });
      newSocket.disconnect();
    };
  }, [partyId]);

  // 시뮬레이션 시작
  const startSimulation = useCallback(() => {
    if (socketRef.current && partyId) {
      socketRef.current.emit("startPartySimulation", { partyId });
    }
  }, [partyId]);

  return {
    socket,
    connected,
    partyState,
    conversations,
    systemMessages,
    startSimulation,
  };
}
