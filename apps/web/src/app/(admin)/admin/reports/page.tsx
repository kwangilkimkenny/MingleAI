"use client";

import { useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import { getSafetyReports, type SafetyReport } from "@/lib/api/admin";
import SafetyReportTable from "@/components/admin/reports/SafetyReportTable";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending");

  const limit = 20;

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSafetyReports({
        status: status || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setReports(res.reports);
      setTotal(res.total);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const totalPages = Math.ceil(total / limit);
  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        신고 관리
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        총 {total}건의 신고
      </Typography>

      {pendingCount > 0 && status === "pending" && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          처리 대기 중인 신고가 {pendingCount}건 있습니다.
        </Alert>
      )}

      <Box display="flex" gap={2} mb={3}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>상태</InputLabel>
          <Select
            value={status}
            label="상태"
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">전체</MenuItem>
            <MenuItem value="pending">대기중</MenuItem>
            <MenuItem value="resolved">처리됨</MenuItem>
            <MenuItem value="dismissed">기각</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={60} sx={{ mb: 1 }} />
          ))}
        </Box>
      ) : reports.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography color="text.secondary">
            {status === "pending"
              ? "처리 대기 중인 신고가 없습니다"
              : "조건에 맞는 신고가 없습니다"}
          </Typography>
        </Box>
      ) : (
        <>
          <SafetyReportTable reports={reports} onRefresh={loadReports} />

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
