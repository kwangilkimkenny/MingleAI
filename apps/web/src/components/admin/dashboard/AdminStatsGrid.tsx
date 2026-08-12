"use client";

import { useCallback, useEffect, useState } from "react";
import Grid from "@mui/material/Grid2";
import Skeleton from "@mui/material/Skeleton";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import PeopleIcon from "@mui/icons-material/People";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import ReportIcon from "@mui/icons-material/Report";
import StatsCard from "./StatsCard";
import LoadError from "@/components/admin/LoadError";
import { getAdminStats, type AdminStats } from "@/lib/api/admin";

export default function AdminStatsGrid() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getAdminStats()
      .then(setStats)
      // 실패하면 카드가 통째로 사라져서 지표가 원래 없는 화면처럼 보였다 — 실패를 남긴다.
      .catch((err: unknown) => {
        setStats(null);
        setError(err instanceof Error ? err.message : null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Grid container spacing={3}>
        {[1, 2, 3].map((i) => (
          <Grid key={i} size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Skeleton height={80} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (!stats) return <LoadError message={error ?? undefined} onRetry={load} />;

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 4 }}>
        <StatsCard
          title="가입 계정"
          value={stats.totalUsers}
          icon={PeopleIcon}
          subtitle="소셜 로그인 누적"
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <StatsCard
          title="활성 프로필"
          value={stats.activeUsers}
          icon={HowToRegIcon}
          color="info"
          subtitle="정지·삭제 제외"
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <StatsCard
          title="대기 중 신고"
          value={stats.pendingReports}
          icon={ReportIcon}
          color={stats.pendingReports > 0 ? "error" : "success"}
          subtitle="처리 필요"
        />
      </Grid>
    </Grid>
  );
}
