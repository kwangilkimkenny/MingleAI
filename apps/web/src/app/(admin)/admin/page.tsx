"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid2";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Button from "@mui/material/Button";
import { useRouter } from "next/navigation";
import AdminStatsGrid from "@/components/admin/dashboard/AdminStatsGrid";

type Health = "checking" | "ok" | "down";

const HEALTH_LABEL: Record<Health, string> = {
  checking: "확인 중",
  ok: "정상",
  down: "응답 없음",
};

/**
 * 상태는 실제로 물어봐서 채운다. 2026-08-12 이전에는 "정상" 세 줄이 하드코딩돼 있어서
 * 서버가 죽어도 초록색이었다 — 관리자 화면에서 가장 위험한 종류의 거짓말이다.
 */
function useHealth(path: string): Health {
  const [state, setState] = useState<Health>("checking");
  useEffect(() => {
    let alive = true;
    fetch(`/api${path}`)
      .then((res) => alive && setState(res.ok ? "ok" : "down"))
      .catch(() => alive && setState("down"));
    return () => {
      alive = false;
    };
  }, [path]);
  return state;
}

function HealthRow({ label, state }: { label: string; state: Health }) {
  return (
    <Box display="flex" justifyContent="space-between">
      <Typography variant="body2">{label}</Typography>
      <Typography
        variant="body2"
        color={
          state === "ok" ? "success.main" : state === "down" ? "error.main" : "text.secondary"
        }
      >
        {HEALTH_LABEL[state]}
      </Typography>
    </Box>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const api = useHealth("/health");
  const db = useHealth("/health/ready");

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        관리자 대시보드
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        mingles 서비스 현황을 한눈에 확인하세요
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
            <CardHeader title="시스템 상태" subheader="이 화면을 열 때 실제로 확인한 값" />
            <CardContent>
              <Box display="flex" flexDirection="column" gap={1}>
                <HealthRow label="API 서버" state={api} />
                <HealthRow label="데이터베이스" state={db} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
