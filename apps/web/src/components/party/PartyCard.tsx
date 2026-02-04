"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import type { Party } from "@mingle/shared";
import { PARTY_STATUS_LABELS } from "@/lib/constants";

const STATUS_COLORS: Record<string, "default" | "info" | "success" | "warning"> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "default",
};

interface PartyCardProps {
  party: Party;
  onClick?: () => void;
}

export default function PartyCard({ party, onClick }: PartyCardProps) {
  return (
    <Card>
      <CardActionArea onClick={onClick} disabled={!onClick}>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={1}
          >
            <Typography variant="h6" fontWeight={600}>
              {party.name}
            </Typography>
            <Chip
              label={PARTY_STATUS_LABELS[party.status]}
              color={STATUS_COLORS[party.status]}
              size="small"
            />
          </Box>
          {party.theme && (
            <Typography variant="body2" color="text.secondary" mb={1}>
              {party.theme}
            </Typography>
          )}
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip
              label={new Date(party.scheduledAt).toLocaleString("ko-KR")}
              variant="outlined"
              size="small"
            />
            <Chip
              label={`최대 ${party.maxParticipants}명`}
              variant="outlined"
              size="small"
            />
            <Chip
              label={`${party.roundCount}라운드`}
              variant="outlined"
              size="small"
            />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
