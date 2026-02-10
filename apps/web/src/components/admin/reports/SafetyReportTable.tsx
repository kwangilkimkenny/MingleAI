"use client";

import { useState } from "react";
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
import { type SafetyReport, resolveSafetyReport } from "@/lib/api/admin";

interface SafetyReportTableProps {
  reports: SafetyReport[];
  onRefresh: () => void;
}

export default function SafetyReportTable({
  reports,
  onRefresh,
}: SafetyReportTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SafetyReport | null>(null);
  const [resolution, setResolution] = useState<{
    status: "resolved" | "dismissed";
    action: "warn" | "suspend" | "ban" | "none";
    notes: string;
  }>({
    status: "resolved",
    action: "none",
    notes: "",
  });

  const handleResolveClick = (report: SafetyReport) => {
    setSelectedReport(report);
    setResolution({ status: "resolved", action: "none", notes: "" });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedReport) return;

    try {
      await resolveSafetyReport(selectedReport.id, resolution);
      setDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error(error);
      alert("처리에 실패했습니다");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string): "warning" | "success" | "default" => {
    switch (status) {
      case "pending":
        return "warning";
      case "resolved":
        return "success";
      case "dismissed":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
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
  };

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
              <TableRow key={report.id} hover>
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
                  {report.status === "pending" && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleResolveClick(report)}
                    >
                      처리
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>신고 처리</DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  신고 내용
                </Typography>
                <Typography>{selectedReport.reason}</Typography>
                {selectedReport.details && (
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    {selectedReport.details}
                  </Typography>
                )}
              </Box>

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
                        action: e.target.value as
                          | "warn"
                          | "suspend"
                          | "ban"
                          | "none",
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
                label="처리 메모"
                multiline
                rows={3}
                value={resolution.notes}
                onChange={(e) =>
                  setResolution({ ...resolution, notes: e.target.value })
                }
                fullWidth
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSubmit}>
            처리 완료
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
