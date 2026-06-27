"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Fade from "@mui/material/Fade";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import PeopleIcon from "@mui/icons-material/People";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import TableBarIcon from "@mui/icons-material/TableBar";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import type { PartyState, ConversationEvent } from "@/hooks/usePartySocket";

// ─── 상수 ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#f87171", "#fb923c", "#fbbf24", "#34d399",
  "#22d3ee", "#818cf8", "#e879f9", "#a78bfa",
];

function avatarColor(name: string) {
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const EMOTION_EMOJI: Record<string, string> = {
  happy: "😊", curious: "🤔", excited: "😄", thoughtful: "💭", neutral: "😐",
};

// ─── 공통 글래스 스타일 ───────────────────────────────────────────────────────

const glass = {
  background: "rgba(6,6,18,0.85)",
  backdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.08)",
};

// ─── 대화 항목 ────────────────────────────────────────────────────────────────

function ConvItem({ conv }: { conv: ConversationEvent }) {
  const color = avatarColor(conv.speaker.name);

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        mb: 1.5,
        animation: "slideIn 0.25s ease-out",
        "@keyframes slideIn": {
          from: { opacity: 0, transform: "translateX(8px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
      }}
    >
      {/* 아바타 */}
      <Box
        sx={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%, ${color}dd, ${color}66)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "white",
          flexShrink: 0,
          boxShadow: `0 0 10px ${color}50`,
        }}
      >
        {conv.speaker.name.charAt(0)}
      </Box>

      {/* 내용 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.3 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color }}>
            {conv.speaker.name}
          </Typography>
          {conv.emotion && (
            <span style={{ fontSize: "11px" }}>
              {EMOTION_EMOJI[conv.emotion] ?? ""}
            </span>
          )}
        </Box>
        <Typography
          sx={{ fontSize: 12, color: "rgba(255,255,255,0.72)", lineHeight: 1.55, wordBreak: "break-word" }}
        >
          {conv.message}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── 라운드 전환 오버레이 ─────────────────────────────────────────────────────

function RoundOverlay({ round, total, visible }: { round: number; total: number; visible: boolean }) {
  return (
    <Fade in={visible} timeout={400}>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 20,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, rgba(109,40,217,0.28) 0%, rgba(0,0,0,0.72) 70%)",
        }}
      >
        <Box sx={{ textAlign: "center" }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              color: "#a78bfa",
              letterSpacing: "0.5em",
              mb: 1,
              textTransform: "uppercase",
            }}
          >
            Round
          </Typography>
          <Typography
            sx={{
              fontSize: "min(22vw, 110px)",
              fontWeight: 900,
              lineHeight: 0.9,
              background: "linear-gradient(160deg, #ffffff 0%, #c4b5fd 45%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 40px rgba(139,92,246,0.9))",
              animation: "popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              "@keyframes popIn": {
                from: { transform: "scale(0.5)", opacity: 0 },
                to: { transform: "scale(1)", opacity: 1 },
              },
            }}
          >
            {round}
          </Typography>
          <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.35)", mt: 1 }}>
            / {total} 라운드
          </Typography>
        </Box>
      </Box>
    </Fade>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

interface PartyViewerUIProps {
  partyState: PartyState | null;
  conversations: ConversationEvent[];
  systemMessages: string[];
  connected: boolean;
  onStart: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export default function PartyViewerUI({
  partyState,
  conversations,
  systemMessages,
  connected,
  onStart,
  isFullscreen,
  onToggleFullscreen,
}: PartyViewerUIProps) {
  const router = useRouter();
  const [showChat, setShowChat] = useState(true);
  const [roundOverlay, setRoundOverlay] = useState(false);
  const prevRound = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 채팅 자동 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations]);

  // 라운드 변경 시 오버레이
  useEffect(() => {
    const r = partyState?.currentRound ?? 0;
    if (r > 0 && r !== prevRound.current) {
      prevRound.current = r;
      setRoundOverlay(true);
      const t = setTimeout(() => setRoundOverlay(false), 2400);
      return () => clearTimeout(t);
    }
  }, [partyState?.currentRound]);

  const status = partyState?.status;
  const statusConfig = {
    waiting:   { label: "대기중",   color: "#60a5fa", bg: "rgba(96,165,250,0.14)", border: "rgba(96,165,250,0.28)" },
    running:   { label: "진행중",   color: "#4ade80", bg: "rgba(74,222,128,0.14)", border: "rgba(74,222,128,0.28)" },
    paused:    { label: "일시정지", color: "#fbbf24", bg: "rgba(251,191,36,0.14)", border: "rgba(251,191,36,0.28)" },
    completed: { label: "완료",     color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.2)" },
  };
  const sc = status ? statusConfig[status] : null;

  return (
    <>
      {/* ── 상단 좌측: 파티 상태 HUD ── */}
      <Box
        sx={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          pointerEvents: "auto",
          maxWidth: 230,
        }}
      >
        <Box sx={{ ...glass, p: "10px 14px", borderRadius: "12px" }}>
          {/* 제목 + 상태 */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "white", lineHeight: 1 }}>
              🎉 MingleAI 파티
            </Typography>
            {sc && (
              <Box
                sx={{
                  px: 0.8,
                  py: 0.15,
                  borderRadius: "6px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: sc.color,
                  background: sc.bg,
                  border: `1px solid ${sc.border}`,
                  letterSpacing: "0.04em",
                  flexShrink: 0,
                }}
              >
                {sc.label}
              </Box>
            )}
          </Box>

          {/* 참가자 수 + 라운드 */}
          {partyState && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <PeopleIcon sx={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }} />
                <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  {partyState.participants.length}명
                </Typography>
              </Box>
              {partyState.currentRound > 0 && (
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#c4b5fd" }}>
                  Round {partyState.currentRound}/{partyState.totalRounds}
                </Typography>
              )}
            </Box>
          )}

          {/* 라운드 프로그레스 바 */}
          {status === "running" && partyState && partyState.totalRounds > 0 && (
            <Box
              sx={{
                height: 3,
                borderRadius: 2,
                background: "rgba(255,255,255,0.07)",
                overflow: "hidden",
                mb: 0.75,
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  width: `${(partyState.currentRound / partyState.totalRounds) * 100}%`,
                  background: "linear-gradient(90deg, #8b5cf6, #ec4899)",
                  borderRadius: 2,
                  transition: "width 0.6s ease",
                  boxShadow: "0 0 8px rgba(139,92,246,0.7)",
                }}
              />
            </Box>
          )}

          {/* 연결 상태 */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {connected ? (
              <WifiIcon sx={{ fontSize: 11, color: "#4ade80" }} />
            ) : (
              <WifiOffIcon sx={{ fontSize: 11, color: "#fb923c" }} />
            )}
            <Typography sx={{ fontSize: 10, color: connected ? "#4ade80" : "#fb923c" }}>
              {connected ? "연결됨" : "연결 중..."}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── 상단 우측: 컨트롤 ── */}
      <Box
        sx={{
          position: "absolute",
          top: 12,
          right: showChat ? 332 : 12,
          transition: "right 0.3s ease",
          zIndex: 10,
          pointerEvents: "auto",
        }}
      >
        <Box sx={{ ...glass, borderRadius: "10px", display: "flex", p: 0.6, gap: 0.25 }}>
          <IconButton
            size="small"
            onClick={() => setShowChat(!showChat)}
            sx={{
              width: 34,
              height: 34,
              borderRadius: "8px",
              color: showChat ? "#c4b5fd" : "rgba(255,255,255,0.4)",
              background: showChat ? "rgba(139,92,246,0.18)" : "transparent",
              "&:hover": { background: "rgba(139,92,246,0.14)", color: "#c4b5fd" },
            }}
          >
            <ChatBubbleIcon sx={{ fontSize: 15 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={onToggleFullscreen}
            sx={{
              width: 34,
              height: 34,
              borderRadius: "8px",
              color: "rgba(255,255,255,0.4)",
              "&:hover": { background: "rgba(255,255,255,0.07)", color: "white" },
            }}
          >
            {isFullscreen ? (
              <FullscreenExitIcon sx={{ fontSize: 15 }} />
            ) : (
              <FullscreenIcon sx={{ fontSize: 15 }} />
            )}
          </IconButton>
        </Box>
      </Box>

      {/* ── 우측: 대화 패널 ── */}
      <Box
        sx={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 320,
          transform: showChat ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          background: "rgba(4,4,14,0.9)",
          backdropFilter: "blur(24px)",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          pointerEvents: "auto",
        }}
      >
        {/* 헤더 */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            height: 44,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <ChatBubbleIcon sx={{ fontSize: 13, color: "#a78bfa" }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>
            실시간 대화
          </Typography>
          {conversations.length > 0 && (
            <Typography sx={{ ml: "auto", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
              {conversations.length}개
            </Typography>
          )}
        </Box>

        {/* 시스템 메시지 */}
        {systemMessages.length > 0 && (
          <Box
            sx={{
              px: 2,
              py: 0.75,
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              flexShrink: 0,
            }}
          >
            <Typography
              sx={{
                fontSize: 11,
                color: "#a78bfa",
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              {systemMessages[systemMessages.length - 1]}
            </Typography>
          </Box>
        )}

        {/* 메시지 목록 */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            p: "12px 14px",
            "&::-webkit-scrollbar": { width: 3 },
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(139,92,246,0.3)",
              borderRadius: 4,
            },
          }}
        >
          {conversations.length === 0 ? (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.5,
                opacity: 0.3,
              }}
            >
              <ChatBubbleIcon sx={{ fontSize: 36, color: "rgba(255,255,255,0.3)" }} />
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.7 }}>
                파티가 시작되면
                <br />대화가 표시됩니다
              </Typography>
            </Box>
          ) : (
            conversations.slice(-20).map((conv, i) => (
              <ConvItem key={`${conv.timestamp}-${i}`} conv={conv} />
            ))
          )}
          <div ref={chatEndRef} />
        </Box>

        {/* 테이블 표시 */}
        {conversations.length > 0 && (
          <Box
            sx={{
              px: 2,
              py: 0.75,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              flexShrink: 0,
            }}
          >
            <TableBarIcon sx={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }} />
            <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.22)" }}>
              {conversations[conversations.length - 1]?.tableId?.replace("table-", "테이블 ")}
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── 라운드 전환 오버레이 ── */}
      <RoundOverlay
        round={partyState?.currentRound ?? 0}
        total={partyState?.totalRounds ?? 0}
        visible={roundOverlay}
      />

      {/* ── 시작 버튼 ── */}
      {status === "waiting" && (
        <Fade in timeout={600}>
          <Box
            sx={{
              position: "absolute",
              bottom: 40,
              left: showChat ? "calc(50% - 160px)" : "50%",
              transform: showChat ? "translateX(0)" : "translateX(-50%)",
              transition: "left 0.3s ease, transform 0.3s ease",
              zIndex: 10,
              textAlign: "center",
            }}
          >
            {partyState && partyState.participants.length > 0 && (
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.3)", mb: 1.5, letterSpacing: "0.08em" }}>
                {partyState.participants.length}명이 파티를 기다리고 있습니다
              </Typography>
            )}
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={onStart}
              sx={{
                px: 5,
                py: 1.6,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "0.04em",
                background: "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
                borderRadius: "14px",
                boxShadow:
                  "0 0 24px rgba(124,58,237,0.5), 0 0 60px rgba(219,39,119,0.18), inset 0 1px 0 rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.1)",
                "&:hover": {
                  background: "linear-gradient(135deg, #6d28d9 0%, #be185d 100%)",
                  boxShadow:
                    "0 0 36px rgba(124,58,237,0.7), 0 0 80px rgba(219,39,119,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
                  transform: "translateY(-2px) scale(1.02)",
                },
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              파티 시작하기
            </Button>
          </Box>
        </Fade>
      )}

      {/* ── 완료 화면 ── */}
      {status === "completed" && (
        <Fade in timeout={800}>
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "radial-gradient(ellipse at 50% 40%, rgba(109,40,217,0.22) 0%, rgba(0,0,0,0.82) 70%)",
              zIndex: 15,
              pointerEvents: "auto",
            }}
          >
            <Box
              sx={{
                textAlign: "center",
                p: "32px 48px",
                borderRadius: "20px",
                background: "rgba(6,6,18,0.92)",
                border: "1px solid rgba(167,139,250,0.22)",
                boxShadow:
                  "0 0 60px rgba(139,92,246,0.18), 0 0 120px rgba(139,92,246,0.08)",
                backdropFilter: "blur(30px)",
                maxWidth: 340,
              }}
            >
              <EmojiEventsIcon
                sx={{
                  fontSize: 52,
                  color: "#fbbf24",
                  filter: "drop-shadow(0 0 16px rgba(251,191,36,0.6))",
                  mb: 1,
                }}
              />
              <Typography
                sx={{
                  fontSize: 26,
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #ffffff 0%, #c4b5fd 60%, #818cf8 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mb: 0.75,
                }}
              >
                파티 완료! 🎊
              </Typography>
              <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.38)", mb: 3 }}>
                모든 라운드가 마무리되었습니다
              </Typography>
              <Button
                variant="contained"
                fullWidth
                onClick={() => {
                  const pathParts = window.location.pathname.split("/");
                  const id = pathParts[pathParts.indexOf("parties") + 1];
                  router.push(`/parties/${id}/results`);
                }}
                sx={{
                  py: 1.2,
                  fontWeight: 700,
                  fontSize: 14,
                  background: "linear-gradient(135deg, #7c3aed, #db2777)",
                  borderRadius: "10px",
                  boxShadow: "0 0 20px rgba(124,58,237,0.4)",
                  "&:hover": {
                    background: "linear-gradient(135deg, #6d28d9, #be185d)",
                    boxShadow: "0 0 30px rgba(124,58,237,0.6)",
                  },
                }}
              >
                매칭 리포트 보기 →
              </Button>
            </Box>
          </Box>
        </Fade>
      )}
    </>
  );
}
