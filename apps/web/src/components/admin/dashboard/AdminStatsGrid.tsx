"use client";

import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid2";
import Skeleton from "@mui/material/Skeleton";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import PeopleIcon from "@mui/icons-material/People";
import CelebrationIcon from "@mui/icons-material/Celebration";
import EventIcon from "@mui/icons-material/Event";
import ReportIcon from "@mui/icons-material/Report";
import StatsCard from "@/components/dashboard/StatsCard";
import { getAdminStats, type AdminStats } from "@/lib/api/admin";

export default function AdminStatsGrid() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Grid container spacing={3}>
        {[1, 2, 3, 4].map((i) => (
          <Grid key={i} size={{ xs: 6, md: 3 }}>
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

  if (!stats) return null;

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatsCard
          title="전체 사용자"
          value={stats.totalUsers}
          icon={PeopleIcon}
          color="primary"
          subtitle={`활성: ${stats.activeUsers}명`}
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatsCard
          title="전체 파티"
          value={stats.totalParties}
          icon={CelebrationIcon}
          color="success"
          subtitle={`예정: ${stats.scheduledParties} / 완료: ${stats.completedParties}`}
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatsCard
          title="예약"
          value={stats.totalReservations}
          icon={EventIcon}
          color="info"
          subtitle="확정된 예약"
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
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
