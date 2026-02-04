"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import type { MatchScore } from "@mingle/shared";

const BREAKDOWN_LABELS: Record<string, string> = {
  valuesAlignment: "가치관 일치",
  lifestyleCompatibility: "라이프스타일 호환",
  communicationFit: "소통 적합도",
  interestChemistry: "관심사 케미",
};

export default function MatchScoreCard({ score }: { score: MatchScore }) {
  return (
    <Card>
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6" fontWeight={600}>
            {score.partnerName}
          </Typography>
          <Typography
            variant="h4"
            fontWeight={700}
            color="primary"
          >
            {Math.round(score.overallScore)}점
          </Typography>
        </Box>

        <Box display="flex" flexDirection="column" gap={1.5} mb={2}>
          {Object.entries(score.breakdown).map(([key, value]) => (
            <Box key={key}>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2">
                  {BREAKDOWN_LABELS[key] || key}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {Math.round(value)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={value}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          ))}
        </Box>

        <Typography variant="body2" color="text.secondary">
          {score.explanation}
        </Typography>
      </CardContent>
    </Card>
  );
}
