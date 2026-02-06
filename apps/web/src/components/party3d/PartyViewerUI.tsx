"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Fade from "@mui/material/Fade";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import PeopleIcon from "@mui/icons-material/People";
import ChatIcon from "@mui/icons-material/Chat";
import type { PartyState, ConversationEvent } from "@/hooks/usePartySocket";

interface PartyViewerUIProps {
  partyState: PartyState | null;
  conversations: ConversationEvent[];
  systemMessages: string[];
  connected: boolean;
  onStart: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

// 대화 로그 항목
function ConversationItem({ conv }: { conv: ConversationEvent }) {
  const emotionEmoji: Record<string, string> = {
    happy: "😊",
    curious: "🤔",
    excited: "😄",
    thoughtful: "💭",
    neutral: "😐",
  };

  return (
    <Box sx={{ mb: 1.5, animation: "fadeIn 0.3s ease-in" }}>
      <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
        <Typography variant="caption" fontWeight={600} color="primary.main">
          {conv.speaker.name}
        </Typography>
        {conv.emotion && (
          <span style={{ fontSize: "12px" }}>
            {emotionEmoji[conv.emotion] || ""}
          </span>
        )}
      </Box>
      <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "13px" }}>
        {conv.message}
      </Typography>
    </Box>
  );
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
  const [showChat, setShowChat] = useState(true);

  const statusLabel = {
    waiting: "대기 중",
    running: "진행 중",
    paused: "일시정지",
    completed: "완료",
  };

  const statusColor = {
    waiting: "info",
    running: "success",
    paused: "warning",
    completed: "default",
  } as const;

  return (
    <>
      {/* 상단 헤더 */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        {/* 왼쪽: 파티 정보 */}
        <Paper
          sx={{
            p: 2,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(10px)",
            pointerEvents: "auto",
          }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="h6" color="white" fontWeight={700}>
              🎉 MingleAI 파티
            </Typography>
            {partyState && (
              <Chip
                label={statusLabel[partyState.status]}
                color={statusColor[partyState.status]}
                size="small"
              />
            )}
          </Box>

          {partyState && (
            <>
              <Box display="flex" alignItems="center" gap={2} mb={1}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <PeopleIcon sx={{ fontSize: 16, color: "grey.400" }} />
                  <Typography variant="body2" color="grey.400">
                    {partyState.participants.length}명 참가
                  </Typography>
                </Box>
                {partyState.status === "running" && (
                  <Typography variant="body2" color="primary.main">
                    라운드 {partyState.currentRound}/{partyState.totalRounds}
                  </Typography>
                )}
              </Box>

              {partyState.status === "running" && (
                <LinearProgress
                  variant="determinate"
                  value={(partyState.currentRound / partyState.totalRounds) * 100}
                  sx={{ height: 4, borderRadius: 2 }}
                />
              )}
            </>
          )}

          <Chip
            label={connected ? "연결됨" : "연결 중..."}
            color={connected ? "success" : "warning"}
            size="small"
            sx={{ mt: 1 }}
          />
        </Paper>

        {/* 오른쪽: 컨트롤 */}
        <Box sx={{ pointerEvents: "auto", display: "flex", gap: 1 }}>
          <IconButton
            onClick={() => setShowChat(!showChat)}
            sx={{ background: "rgba(0,0,0,0.5)", color: "white" }}
          >
            <ChatIcon />
          </IconButton>
          <IconButton
            onClick={onToggleFullscreen}
            sx={{ background: "rgba(0,0,0,0.5)", color: "white" }}
          >
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* 대화 로그 패널 */}
      <Fade in={showChat}>
        <Paper
          sx={{
            position: "absolute",
            right: 16,
            top: 100,
            bottom: 100,
            width: 320,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(10px)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            zIndex: 10,
          }}
        >
          <Box sx={{ p: 2, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <Typography variant="subtitle1" color="white" fontWeight={600}>
              💬 실시간 대화
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              p: 2,
              "&::-webkit-scrollbar": { width: 4 },
              "&::-webkit-scrollbar-thumb": {
                background: "rgba(255,255,255,0.2)",
                borderRadius: 2,
              },
            }}
          >
            {/* 시스템 메시지 */}
            {systemMessages.slice(-3).map((msg, i) => (
              <Typography
                key={i}
                variant="caption"
                sx={{
                  display: "block",
                  color: "grey.500",
                  textAlign: "center",
                  mb: 1,
                  fontStyle: "italic",
                }}
              >
                {msg}
              </Typography>
            ))}

            {/* 대화 */}
            {conversations.length === 0 ? (
              <Typography
                variant="body2"
                color="grey.500"
                textAlign="center"
                sx={{ mt: 4 }}
              >
                파티가 시작되면 대화가 표시됩니다
              </Typography>
            ) : (
              conversations.slice(-15).map((conv, i) => (
                <ConversationItem key={`${conv.timestamp}-${i}`} conv={conv} />
              ))
            )}
          </Box>
        </Paper>
      </Fade>

      {/* 하단: 시작 버튼 */}
      {partyState?.status === "waiting" && (
        <Box
          sx={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
          }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayArrowIcon />}
            onClick={onStart}
            sx={{
              px: 6,
              py: 2,
              fontSize: "1.2rem",
              background: "linear-gradient(45deg, #E91E63, #FF6F00)",
              "&:hover": {
                background: "linear-gradient(45deg, #C2185B, #E65100)",
              },
            }}
          >
            파티 시작하기
          </Button>
        </Box>
      )}

      {/* 완료 메시지 */}
      {partyState?.status === "completed" && (
        <Box
          sx={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
          }}
        >
          <Paper
            sx={{
              px: 4,
              py: 2,
              background: "rgba(0,0,0,0.8)",
              textAlign: "center",
            }}
          >
            <Typography variant="h5" color="white" fontWeight={700}>
              🎊 파티 완료!
            </Typography>
            <Typography variant="body2" color="grey.400" mt={1}>
              매칭 리포트에서 결과를 확인하세요
            </Typography>
          </Paper>
        </Box>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
