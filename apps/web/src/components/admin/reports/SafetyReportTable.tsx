"use client";

import { useCallback, useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import {
  type SafetyReport,
  type SafetyReportDetail,
  getSafetyReportDetail,
  resolveSafetyReport,
  reinstateProfile,
} from "@/lib/api/admin";

interface SafetyReportTableProps {
  reports: SafetyReport[];
  onRefresh: () => void;
}

function getStatusColor(status: string): "warning" | "success" | "default" {
  switch (status) {
    case "pending":
      return "warning";
    case "resolved":
      return "success";
    default:
      return "default";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "대기중";
    case "resolved":
      return "처리됨";
    case "dismissed":
      return "기각";
    default:
      return status;
  }
}

function getProfileStatusColor(status: string): "success" | "error" | "warning" | "default" {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
    case "banned":
      return "error";
    case "deleted":
      return "default";
    default:
      return "warning";
  }
}

function getProfileStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "활성";
    case "suspended":
      return "정지";
    case "banned":
      return "영구 차단";
    case "deleted":
      return "삭제됨";
    default:
      return status;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SafetyReportTable({ reports, onRefresh }: SafetyReportTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detail, setDetail] = useState<SafetyReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resolution, setResolution] = useState<{
    status: "resolved" | "dismissed";
    action: "warn" | "suspend" | "ban" | "none";
    notes: string;
  }>({ status: "resolved", action: "none", notes: "" });

  const loadDetail = useCallback(async (reportId: string) => {
    setDetailLoading(true);
    setError("");
    try {
      setDetail(await getSafetyReportDetail(reportId));
    } catch (err) {
      console.error(err);
      setError("신고 상세를 불러오지 못했습니다.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleRowClick = (report: SafetyReport) => {
    setDetail(null);
    setResolution({ status: "resolved", action: "none", notes: "" });
    setDialogOpen(true);
    void loadDetail(report.id);
  };

  const handleSubmit = async () => {
    if (!detail) return;
    if (
      (resolution.status === "resolved" &&
        (resolution.action === "suspend" || resolution.action === "ban")) &&
      !confirm(
        resolution.action === "suspend"
          ? "이 계정을 정지하시겠습니까? 로그인과 앱 이용이 즉시 차단됩니다."
          : "이 계정을 영구 차단하시겠습니까?",
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await resolveSafetyReport(detail.id, resolution);
      setDialogOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      setError("처리에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReinstate = async () => {
    if (!detail) return;
    if (!confirm("이 계정을 복구(활성화)하시겠습니까?")) return;
    setSubmitting(true);
    setError("");
    try {
      await reinstateProfile(detail.reported.profileId);
      await loadDetail(detail.id);
      onRefresh();
    } catch (err) {
      console.error(err);
      setError("복구에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const reportedSuspended =
    detail?.reported.status === "suspended" || detail?.reported.status === "banned";

  return (
    <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>신고자</TableCell>
              <TableCell>피신고자</TableCell>
              <TableCell>사유</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>신고일</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reports.map((report) => (
              <TableRow
                key={report.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => handleRowClick(report)}
              >
                <TableCell>{report.reporter.name}</TableCell>
                <TableCell>{report.reported.name}</TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2">{report.reason}</Typography>
                    {report.details && (
                      <Typography variant="caption" color="text.secondary">
                        {report.details.length > 50
                          ? report.details.slice(0, 50) + "..."
                          : report.details}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={getStatusLabel(report.status)}
                    size="small"
                    color={getStatusColor(report.status)}
                  />
                </TableCell>
                <TableCell>{formatDate(report.createdAt)}</TableCell>
                <TableCell>
                  <Button size="small" variant="outlined">
                    상세
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>신고 상세</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {detailLoading || !detail ? (
            <Box sx={{ pt: 1 }}>
              <Skeleton height={32} />
              <Skeleton height={32} />
              <Skeleton height={80} />
            </Box>
          ) : (
            <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="body2">
                  {detail.reporter.name} ({detail.reporter.age}세 / {detail.reporter.gender})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  →
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {detail.reported.name} ({detail.reported.age}세 / {detail.reported.gender})
                </Typography>
                <Chip
                  size="small"
                  label={getProfileStatusLabel(detail.reported.status)}
                  color={getProfileStatusColor(detail.reported.status)}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  신고 사유
                </Typography>
                <Typography>{detail.reason}</Typography>
                {detail.details && (
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    {detail.details}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {formatDate(detail.createdAt)}
                </Typography>
              </Box>

              <Alert severity={detail.reportsAgainstReported > 1 ? "warning" : "info"}>
                이 사용자가 받은 누적 신고: {detail.reportsAgainstReported}건
              </Alert>

              {reportedSuspended && (
                <Box>
                  <Button
                    variant="outlined"
                    color="success"
                    onClick={handleReinstate}
                    disabled={submitting}
                  >
                    계정 복구 (활성화)
                  </Button>
                </Box>
              )}

              {detail.status === "pending" ? (
                <>
                  <Divider />
                  <FormControl fullWidth>
                    <InputLabel>처리 결과</InputLabel>
                    <Select
                      value={resolution.status}
                      label="처리 결과"
                      onChange={(e) =>
                        setResolution({
                          ...resolution,
                          status: e.target.value as "resolved" | "dismissed",
                        })
                      }
                    >
                      <MenuItem value="resolved">처리 완료</MenuItem>
                      <MenuItem value="dismissed">기각</MenuItem>
                    </Select>
                  </FormControl>

                  {resolution.status === "resolved" && (
                    <FormControl fullWidth>
                      <InputLabel>조치</InputLabel>
                      <Select
                        value={resolution.action}
                        label="조치"
                        onChange={(e) =>
                          setResolution({
                            ...resolution,
                            action: e.target.value as "warn" | "suspend" | "ban" | "none",
                          })
                        }
                      >
                        <MenuItem value="none">조치 없음</MenuItem>
                        <MenuItem value="warn">경고</MenuItem>
                        <MenuItem value="suspend">계정 정지</MenuItem>
                        <MenuItem value="ban">영구 차단</MenuItem>
                      </Select>
                    </FormControl>
                  )}

                  <TextField
                    label="처리 메모 (기록용)"
                    multiline
                    rows={3}
                    value={resolution.notes}
                    onChange={(e) => setResolution({ ...resolution, notes: e.target.value })}
                    fullWidth
                  />
                </>
              ) : (
                <Alert severity="success">
                  이미 처리된 신고입니다 ({getStatusLabel(detail.status)}).
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>닫기</Button>
          {detail?.status === "pending" && (
            <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "처리 중..." : "처리 완료"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
