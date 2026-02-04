"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid2";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import { useAuthStore } from "@/lib/store/auth";
import { listReports, generateReport } from "@/lib/api/reports";
import { useApi } from "@/hooks/useApi";
import { REPORT_TYPE_LABELS } from "@/lib/constants";

export default function ReportsPage() {
  const router = useRouter();
  const profileId = useAuthStore((s) => s.profileId);
  const {
    data: reportData,
    loading,
    error,
    refetch,
  } = useApi(
    () => (profileId ? listReports(profileId) : Promise.resolve({ data: [], total: 0 })),
    [profileId],
  );

  const [genPartyId, setGenPartyId] = useState("");
  const [genType, setGenType] = useState<"summary" | "detailed">("summary");
  const [genError, setGenError] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  const handleGenerate = async () => {
    if (!profileId || !genPartyId.trim()) return;
    setGenError("");
    setGenLoading(true);
    try {
      const report = await generateReport({
        partyId: genPartyId.trim(),
        profileId,
        reportType: genType,
      });
      router.push(`/reports/${report.id}`);
    } catch (err) {
      setGenError(
        err instanceof Error ? err.message : "리포트 생성에 실패했습니다.",
      );
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={3}>
        매칭 리포트
      </Typography>

      {/* Generate Report */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            리포트 생성
          </Typography>
          {!profileId && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              프로필을 먼저 만들어주세요.
            </Alert>
          )}
          {genError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {genError}
            </Alert>
          )}
          <Box display="flex" gap={2} flexWrap="wrap">
            <TextField
              size="small"
              label="파티 ID"
              value={genPartyId}
              onChange={(e) => setGenPartyId(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 200 }}
            />
            <TextField
              size="small"
              select
              label="리포트 유형"
              value={genType}
              onChange={(e) =>
                setGenType(e.target.value as "summary" | "detailed")
              }
              sx={{ minWidth: 120 }}
            >
              {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={!profileId || !genPartyId.trim() || genLoading}
            >
              {genLoading ? "생성 중..." : "생성"}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Report List */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        내 리포트
      </Typography>
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : !reportData || reportData.data.length === 0 ? (
        <EmptyState
          title="리포트가 없습니다"
          description="파티 완료 후 리포트를 생성할 수 있습니다."
        />
      ) : (
        <Grid container spacing={2}>
          {reportData.data.map((report) => (
            <Grid size={{ xs: 12, sm: 6 }} key={report.id}>
              <Card>
                <CardActionArea
                  onClick={() => router.push(`/reports/${report.id}`)}
                >
                  <CardContent>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      mb={1}
                    >
                      <Typography variant="subtitle1" fontWeight={600}>
                        리포트
                      </Typography>
                      <Chip
                        label={REPORT_TYPE_LABELS[report.reportType]}
                        size="small"
                        color="primary"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      매칭: {report.matchScores.length}명
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {new Date(report.createdAt).toLocaleString("ko-KR")}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
