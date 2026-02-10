"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid2";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Button from "@mui/material/Button";
import { useRouter } from "next/navigation";
import AdminStatsGrid from "@/components/admin/dashboard/AdminStatsGrid";

export default function AdminDashboardPage() {
  const router = useRouter();

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        관리자 대시보드
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        MingleAI 서비스 현황을 한눈에 확인하세요
      </Typography>

      <AdminStatsGrid />

      <Grid container spacing={3} mt={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="빠른 작업"
              subheader="자주 사용하는 관리 기능"
            />
            <CardContent>
              <Box display="flex" flexWrap="wrap" gap={2}>
                <Button
                  variant="outlined"
                  onClick={() => router.push("/admin/users")}
                >
                  사용자 관리
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => router.push("/admin/parties")}
                >
                  파티 관리
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => router.push("/admin/reports")}
                >
                  신고 처리
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="시스템 상태"
              subheader="서버 및 서비스 상태"
            />
            <CardContent>
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">API 서버</Typography>
                  <Typography variant="body2" color="success.main">
                    정상
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">데이터베이스</Typography>
                  <Typography variant="body2" color="success.main">
                    정상
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">WebSocket</Typography>
                  <Typography variant="body2" color="success.main">
                    정상
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
