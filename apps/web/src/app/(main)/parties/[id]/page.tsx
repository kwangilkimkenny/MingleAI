"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AssessmentIcon from "@mui/icons-material/Assessment";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { getParty, addParticipant, runParty } from "@/lib/api/parties";
import { useApi } from "@/hooks/useApi";
import { useAuthStore } from "@/lib/store/auth";
import { PARTY_STATUS_LABELS } from "@/lib/constants";

export default function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const profileId = useAuthStore((s) => s.profileId);
  const {
    data: party,
    loading,
    error,
    refetch,
  } = useApi(() => getParty(id), [id]);

  const [addProfileId, setAddProfileId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const handleAddParticipant = async () => {
    const pid = addProfileId.trim() || profileId;
    if (!pid) {
      setActionError("프로필 ID를 입력하거나 먼저 프로필을 만들어주세요.");
      return;
    }
    setActionError("");
    setActionLoading(true);
    try {
      await addParticipant(id, pid);
      setAddProfileId("");
      refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "참가 등록에 실패했습니다.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRun = async () => {
    setActionError("");
    setActionLoading(true);
    try {
      await runParty(id);
      refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "파티 실행에 실패했습니다.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="파티 로딩 중..." />;
  if (error)
    return (
      <Typography color="error" p={4}>
        {error}
      </Typography>
    );
  if (!party) return null;

  return (
    <Box maxWidth={700} mx="auto">
      <Typography variant="h4" fontWeight={700} mb={3}>
        {party.name}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
            <Chip
              label={PARTY_STATUS_LABELS[party.status]}
              color={
                party.status === "completed"
                  ? "success"
                  : party.status === "in_progress"
                    ? "warning"
                    : "info"
              }
            />
            <Chip
              label={new Date(party.scheduledAt).toLocaleString("ko-KR")}
              variant="outlined"
            />
            <Chip
              label={`최대 ${party.maxParticipants}명`}
              variant="outlined"
            />
            <Chip
              label={`${party.roundCount}라운드 × ${party.roundDurationMinutes}분`}
              variant="outlined"
            />
          </Box>
          {party.theme && (
            <Typography variant="body1" color="text.secondary">
              테마: {party.theme}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" mt={1}>
            ID: {party.id}
          </Typography>
        </CardContent>
      </Card>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      {party.status === "scheduled" && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" fontWeight={600} mb={2}>
            참가자 등록
          </Typography>
          <Box display="flex" gap={2} mb={2}>
            <TextField
              size="small"
              placeholder={
                profileId
                  ? `프로필 ID (비워두면 내 프로필: ${profileId.slice(-8)})`
                  : "프로필 ID 입력"
              }
              value={addProfileId}
              onChange={(e) => setAddProfileId(e.target.value)}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={handleAddParticipant}
              disabled={actionLoading}
            >
              참가
            </Button>
          </Box>

          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleRun}
            disabled={actionLoading}
            fullWidth
            size="large"
            sx={{ mt: 2 }}
          >
            {actionLoading ? "실행 중..." : "파티 실행"}
          </Button>
        </>
      )}

      {party.status === "completed" && (
        <Button
          variant="contained"
          startIcon={<AssessmentIcon />}
          onClick={() => router.push(`/parties/${id}/results`)}
          fullWidth
          size="large"
        >
          결과 보기
        </Button>
      )}
    </Box>
  );
}
