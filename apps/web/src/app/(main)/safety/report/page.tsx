"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { reportUser } from "@/lib/api/safety";
import { SAFETY_REASON_LABELS } from "@/lib/constants";

export default function SafetyReportPage() {
  const [reportedProfileId, setReportedProfileId] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [evidencePartyId, setEvidencePartyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      await reportUser({
        reportedProfileId,
        reason,
        details: details || undefined,
        evidencePartyId: evidencePartyId || undefined,
      });
      setSuccess(true);
      setReportedProfileId("");
      setReason("");
      setDetails("");
      setEvidencePartyId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "신고에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxWidth={600} mx="auto">
      <Typography variant="h4" fontWeight={700} mb={3}>
        안전 신고
      </Typography>
      <Card>
        <CardContent sx={{ p: 4 }}>
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              신고가 접수되었습니다. 검토 후 조치하겠습니다.
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box
            component="form"
            onSubmit={handleSubmit}
            display="flex"
            flexDirection="column"
            gap={2}
          >
            <TextField
              label="신고 대상 프로필 ID"
              required
              value={reportedProfileId}
              onChange={(e) => setReportedProfileId(e.target.value)}
            />
            <TextField
              label="신고 사유"
              select
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {Object.entries(SAFETY_REASON_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="상세 내용"
              multiline
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
              helperText={`${details.length}/1000`}
            />
            <TextField
              label="증거 파티 ID (선택)"
              value={evidencePartyId}
              onChange={(e) => setEvidencePartyId(e.target.value)}
            />
            <Button
              type="submit"
              variant="contained"
              color="error"
              size="large"
              disabled={loading || !reportedProfileId || !reason}
            >
              {loading ? "신고 중..." : "신고하기"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
