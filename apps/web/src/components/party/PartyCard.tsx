"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import PeopleIcon from "@mui/icons-material/People";
import type { Party } from "@mingle/shared";
import { PARTY_STATUS_LABELS } from "@/lib/constants";

const STATUS_COLORS: Record<string, "default" | "info" | "success" | "warning"> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "default",
};

interface PartyCardProps {
  party: Party & { participantCount?: number };
  onClick?: () => void;
}

export default function PartyCard({ party, onClick }: PartyCardProps) {
  const participantCount = party.participantCount ?? 0;
  const fillPercent = Math.min((participantCount / party.maxParticipants) * 100, 100);
  const isFull = participantCount >= party.maxParticipants;

  return (
    <Card sx={{ height: "100%" }}>
      <CardActionArea onClick={onClick} disabled={!onClick} sx={{ height: "100%" }}>
        <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={1}
          >
            <Typography variant="h6" fontWeight={600} noWrap sx={{ flexGrow: 1, mr: 1 }}>
              {party.name}
            </Typography>
            <Chip
              label={PARTY_STATUS_LABELS[party.status]}
              color={STATUS_COLORS[party.status]}
              size="small"
            />
          </Box>

          {party.theme && (
            <Typography variant="body2" color="text.secondary" mb={1} noWrap>
              테마: {party.theme}
            </Typography>
          )}

          <Typography variant="body2" color="text.secondary" mb={2}>
            {new Date(party.scheduledAt).toLocaleString("ko-KR")}
          </Typography>

          {/* 참가자 현황 */}
          {party.status === "scheduled" && (
            <Box mb={2}>
              <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                <PeopleIcon fontSize="small" color="action" />
                <Typography variant="body2" color={isFull ? "error" : "text.secondary"}>
                  {participantCount} / {party.maxParticipants}명
                  {isFull && " (마감)"}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={fillPercent}
                color={isFull ? "error" : "primary"}
                sx={{ borderRadius: 1, height: 6 }}
              />
            </Box>
          )}

          <Box display="flex" gap={1} flexWrap="wrap" mt="auto">
            <Chip
              label={`${party.roundCount}라운드`}
              variant="outlined"
              size="small"
            />
            <Chip
              label={`${party.roundDurationMinutes}분씩`}
              variant="outlined"
              size="small"
            />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
