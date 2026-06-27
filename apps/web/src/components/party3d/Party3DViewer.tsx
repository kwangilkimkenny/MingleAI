"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import dynamic from "next/dynamic";
import { usePartySocket } from "@/hooks/usePartySocket";
import PartyViewerUI from "./PartyViewerUI";

const PartyScene = dynamic(() => import("./PartyScene"), {
  ssr: false,
  loading: () => (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #060612 0%, #0e0620 50%, #060c1e 100%)",
        gap: 2.5,
      }}
    >
      {/* 로딩 링 */}
      <Box sx={{ position: "relative", width: 72, height: 72 }}>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "2px solid transparent",
            borderTopColor: "#8b5cf6",
            animation: "spin 1s linear infinite",
            "@keyframes spin": { to: { transform: "rotate(360deg)" } },
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 10,
            borderRadius: "50%",
            border: "2px solid transparent",
            borderTopColor: "#ec4899",
            animation: "spin 0.65s linear infinite reverse",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: "50%",
            transform: "translate(-50%, -50%)",
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
          }}
        />
      </Box>
      <Typography sx={{ color: "rgba(255,255,255,0.35)", fontSize: 13, letterSpacing: "0.05em" }}>
        3D 씬 로딩 중...
      </Typography>
    </Box>
  ),
});

interface Party3DViewerProps {
  partyId: string;
}

export default function Party3DViewer({ partyId }: Party3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { connected, partyState, conversations, systemMessages, startSimulation } =
    usePartySocket(partyId);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#060612",
      }}
    >
      <PartyScene
        partyState={partyState}
        conversations={conversations}
        onReady={() => {}}
      />
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
