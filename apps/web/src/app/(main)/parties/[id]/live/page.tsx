"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EqualizerIcon from "@mui/icons-material/Equalizer";
import { Party3DViewer } from "@/components/party3d";

export default function PartyLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#060612",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 헤더 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          height: 52,
          flexShrink: 0,
          background:
            "linear-gradient(to right, rgba(6,6,18,0.98) 0%, rgba(14,6,28,0.98) 100%)",
          borderBottom: "1px solid rgba(147,51,234,0.18)",
          backdropFilter: "blur(20px)",
          zIndex: 10,
        }}
      >
        <IconButton
          onClick={() => router.push(`/parties/${id}`)}
          size="small"
          sx={{
            color: "rgba(255,255,255,0.65)",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            width: 32,
            height: 32,
            "&:hover": { background: "rgba(255,255,255,0.12)", color: "white" },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 17 }} />
        </IconButton>

        {/* LIVE 뱃지 */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 1.25,
            py: 0.35,
            borderRadius: "20px",
            background: "rgba(255,45,45,0.13)",
            border: "1px solid rgba(255,45,45,0.28)",
          }}
        >
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#ff3535",
              boxShadow: "0 0 7px #ff3535",
              animation: "livePulse 1.5s ease-in-out infinite",
              "@keyframes livePulse": {
                "0%, 100%": { opacity: 1, boxShadow: "0 0 7px #ff3535" },
                "50%": { opacity: 0.35, boxShadow: "0 0 3px #ff3535" },
              },
            }}
          />
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 800,
              color: "#ff5555",
              letterSpacing: "0.14em",
            }}
          >
            LIVE
          </Typography>
        </Box>

        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            fontSize: 14,
            background: "linear-gradient(90deg, #ddd6fe 0%, #a5b4fc 60%, #818cf8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          파티 생중계
        </Typography>

        <Box sx={{ flex: 1 }} />

        <Button
          size="small"
          startIcon={<EqualizerIcon sx={{ fontSize: "15px !important" }} />}
          onClick={() => router.push(`/parties/${id}/results`)}
          sx={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 12,
            fontWeight: 600,
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            px: 1.5,
            py: 0.4,
            minWidth: "auto",
            "&:hover": {
              border: "1px solid rgba(167,139,250,0.4)",
              color: "#a78bfa",
              background: "rgba(139,92,246,0.1)",
            },
          }}
        >
          결과 보기
        </Button>
      </Box>

      {/* 3D 뷰어 */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Party3DViewer partyId={id} />
      </Box>
    </Box>
  );
}
