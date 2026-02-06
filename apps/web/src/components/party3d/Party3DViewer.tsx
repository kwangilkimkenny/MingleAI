"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import dynamic from "next/dynamic";
import { usePartySocket } from "@/hooks/usePartySocket";
import PartyViewerUI from "./PartyViewerUI";

// Three.js는 SSR에서 작동하지 않으므로 동적 임포트
const PartyScene = dynamic(() => import("./PartyScene"), {
  ssr: false,
  loading: () => (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(to bottom, #1a1a2e, #16213e)",
        color: "white",
      }}
    >
      3D 씬 로딩 중...
    </Box>
  ),
});

interface Party3DViewerProps {
  partyId: string;
}

export default function Party3DViewer({ partyId }: Party3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);

  const {
    connected,
    partyState,
    conversations,
    systemMessages,
    startSimulation,
  } = usePartySocket(partyId);

  // 풀스크린 토글
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // 풀스크린 변경 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: "100%",
        height: isFullscreen ? "100vh" : "600px",
        minHeight: "500px",
        borderRadius: isFullscreen ? 0 : 2,
        overflow: "hidden",
      }}
    >
      {/* 3D 씬 */}
      <PartyScene
        partyState={partyState}
        conversations={conversations}
        onReady={() => setSceneReady(true)}
      />

      {/* UI 오버레이 */}
      <PartyViewerUI
        partyState={partyState}
        conversations={conversations}
        systemMessages={systemMessages}
        connected={connected}
        onStart={startSimulation}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
    </Box>
  );
}
