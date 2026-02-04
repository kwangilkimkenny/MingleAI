"use client";

import { use } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid2";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import MatchScoreCard from "@/components/report/MatchScoreCard";
import RecommendationCard from "@/components/report/RecommendationCard";
import { getReport } from "@/lib/api/reports";
import { useApi } from "@/hooks/useApi";
import { REPORT_TYPE_LABELS } from "@/lib/constants";

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: report, loading, error } = useApi(() => getReport(id), [id]);

  if (loading) return <LoadingSpinner message="리포트 로딩 중..." />;
  if (error)
    return (
      <Typography color="error" p={4}>
        {error}
      </Typography>
    );
  if (!report) return null;

  return (
    <Box maxWidth={900} mx="auto">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" fontWeight={700}>
          매칭 리포트
        </Typography>
        <Chip
          label={REPORT_TYPE_LABELS[report.reportType]}
          color="primary"
        />
      </Box>

      <Typography variant="caption" color="text.disabled" display="block" mb={4}>
        생성일: {new Date(report.createdAt).toLocaleString("ko-KR")}
      </Typography>

      {/* Match Scores */}
      <Typography variant="h5" fontWeight={600} mb={2}>
        매칭 점수
      </Typography>
      <Grid container spacing={2} mb={4}>
        {report.matchScores.map((score) => (
          <Grid size={{ xs: 12, md: 6 }} key={score.partnerId}>
            <MatchScoreCard score={score} />
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* Highlights */}
      <Typography variant="h5" fontWeight={600} mb={2}>
        대화 하이라이트
      </Typography>
      <Grid container spacing={2} mb={4}>
        {report.highlights.map((h) => (
          <Grid size={{ xs: 12, md: 6 }} key={h.partnerId}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} mb={1}>
                  {h.partnerName}
                </Typography>
                {h.highlights.length > 0 && (
                  <Box mb={1}>
                    <Typography variant="subtitle2" color="primary">
                      하이라이트
                    </Typography>
                    {h.highlights.map((hl, i) => (
                      <Typography key={i} variant="body2">
                        - {hl}
                      </Typography>
                    ))}
                  </Box>
                )}
                {h.sharedInterests.length > 0 && (
                  <Box display="flex" gap={0.5} flexWrap="wrap" mb={1}>
                    {h.sharedInterests.map((si) => (
                      <Chip
                        key={si}
                        label={si}
                        size="small"
                        color="secondary"
                      />
                    ))}
                  </Box>
                )}
                {h.notableExchanges.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      주목할 대화
                    </Typography>
                    {h.notableExchanges.map((ne, i) => (
                      <Typography key={i} variant="body2" color="text.secondary">
                        - {ne}
                      </Typography>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* Recommendations */}
      <Typography variant="h5" fontWeight={600} mb={2}>
        추천 액션
      </Typography>
      <Grid container spacing={2}>
        {report.recommendations.map((rec) => (
          <Grid size={{ xs: 12, md: 6 }} key={rec.partnerId}>
            <RecommendationCard recommendation={rec} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
