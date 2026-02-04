"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { PartyResults } from "@mingle/shared";
import { SIGNAL_TYPE_LABELS } from "@/lib/constants";

export default function PartyResultsView({
  results,
}: {
  results: PartyResults;
}) {
  return (
    <Box>
      {/* Rounds */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        라운드별 결과
      </Typography>
      {results.rounds.map((round) => (
        <Accordion key={round.roundNumber} defaultExpanded={round.roundNumber === 1}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>
              라운드 {round.roundNumber}
            </Typography>
            <Chip
              label={`${round.tables.length}개 테이블`}
              size="small"
              sx={{ ml: 2 }}
            />
          </AccordionSummary>
          <AccordionDetails>
            {round.conversationContexts.map((ctx) => (
              <Card key={ctx.tableId} variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    테이블 {ctx.tableId.slice(-4)}
                  </Typography>
                  <Box display="flex" gap={0.5} flexWrap="wrap" mb={1}>
                    {ctx.participants.map((p) => (
                      <Chip key={p.profileId} label={p.name} size="small" />
                    ))}
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    <strong>아이스브레이커:</strong> {ctx.icebreaker}
                  </Typography>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {ctx.suggestedTopics.map((topic) => (
                      <Chip
                        key={topic}
                        label={topic}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}

      <Divider sx={{ my: 4 }} />

      {/* Interaction Signals */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        상호작용 시그널
      </Typography>
      {results.interactionSignals.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          아직 시그널이 없습니다.
        </Typography>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {results.interactionSignals.map((signal, i) => (
            <Card key={i} variant="outlined">
              <CardContent>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={1}
                >
                  <Typography variant="subtitle2">
                    {signal.fromProfileId.slice(-6)} →{" "}
                    {signal.toProfileId.slice(-6)}
                  </Typography>
                  <Chip
                    label={SIGNAL_TYPE_LABELS[signal.signalType]}
                    size="small"
                    color="primary"
                  />
                </Box>
                <Box display="flex" alignItems="center" gap={2} mb={1}>
                  <Typography variant="body2" sx={{ minWidth: 60 }}>
                    강도: {Math.round(signal.strength * 100)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={signal.strength * 100}
                    sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {signal.context}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
