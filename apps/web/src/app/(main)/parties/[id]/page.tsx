"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import LinearProgress from "@mui/material/LinearProgress";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PeopleIcon from "@mui/icons-material/People";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
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

  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleJoinParty = async () => {
    if (!profileId) {
      router.push("/profile/create");
      return;
    }
    setConfirmDialogOpen(true);
  };

  const confirmJoin = async () => {
    setConfirmDialogOpen(false);
    if (!profileId) return;

    setActionError("");
    setActionLoading(true);
    try {
      await addParticipant(id, profileId);
      setJoinSuccess(true);
      refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "참가 신청에 실패했습니다.",
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

  if (loading) return <LoadingSpinner message="파티 정보를 불러오는 중..." />;
  if (error)
    return (
      <Box p={4}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={() => router.push("/parties")} sx={{ mt: 2 }}>
          파티 목록으로 돌아가기
        </Button>
      </Box>
    );
  if (!party) return null;

  const participantCount = (party as { participantCount?: number }).participantCount ?? 0;
  const fillPercent = Math.min((participantCount / party.maxParticipants) * 100, 100);
  const isFull = participantCount >= party.maxParticipants;

  return (
    <Box maxWidth={700} mx="auto">
      {/* 헤더 */}
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <Typography variant="h4" fontWeight={700}>
            {party.name}
          </Typography>
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
        </Box>
        {party.theme && (
          <Typography variant="h6" color="text.secondary">
            테마: {party.theme}
          </Typography>
        )}
      </Box>

      {/* 파티 정보 카드 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>
            파티 정보
          </Typography>

          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" justifyContent="space-between">
              <Typography color="text.secondary">일시</Typography>
              <Typography fontWeight={500}>
                {new Date(party.scheduledAt).toLocaleString("ko-KR")}
              </Typography>
            </Box>

            <Box display="flex" justifyContent="space-between">
              <Typography color="text.secondary">라운드</Typography>
              <Typography fontWeight={500}>
                {party.roundCount}라운드 × {party.roundDurationMinutes}분
              </Typography>
            </Box>

            {party.status === "scheduled" && (
              <>
                <Divider />
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <PeopleIcon color="action" />
                      <Typography color="text.secondary">참가 현황</Typography>
                    </Box>
                    <Typography fontWeight={500} color={isFull ? "error.main" : "text.primary"}>
                      {participantCount} / {party.maxParticipants}명
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={fillPercent}
                    color={isFull ? "error" : "primary"}
                    sx={{ borderRadius: 1, height: 8 }}
                  />
                  {isFull && (
                    <Typography variant="body2" color="error" mt={1}>
                      이 파티는 정원이 가득 찼습니다.
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </Box>

          <Typography variant="caption" color="text.secondary" display="block" mt={2}>
            파티 ID: {party.id}
          </Typography>
        </CardContent>
      </Card>

      {/* 알림 메시지 */}
      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError("")}>
          {actionError}
        </Alert>
      )}

      {joinSuccess && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          icon={<CheckCircleIcon />}
          onClose={() => setJoinSuccess(false)}
        >
          파티에 성공적으로 참가 신청했습니다! 파티가 시작되면 AI 에이전트가 당신을 대신해 대화합니다.
        </Alert>
      )}

      {/* 참가 안내 (프로필 없는 경우) */}
      {!profileId && party.status === "scheduled" && (
        <Alert severity="info" sx={{ mb: 3 }}>
          파티에 참가하려면 먼저 프로필을 만들어야 합니다.
          프로필을 만들면 AI 에이전트가 파티에서 당신을 대신해 다른 참가자들과 대화합니다.
        </Alert>
      )}

      {/* 액션 버튼 */}
      {party.status === "scheduled" && (
        <Box display="flex" flexDirection="column" gap={2}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<PersonAddIcon />}
            onClick={handleJoinParty}
            disabled={actionLoading || isFull || joinSuccess}
          >
            {!profileId
              ? "프로필 만들고 참가하기"
              : joinSuccess
                ? "참가 완료!"
                : isFull
                  ? "정원 마감"
                  : "이 파티에 참가하기"}
          </Button>

          <Divider sx={{ my: 1 }}>
            <Typography variant="caption" color="text.secondary">
              관리자 기능
            </Typography>
          </Divider>

          <Button
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={handleRun}
            disabled={actionLoading || participantCount < 2}
          >
            {actionLoading ? "실행 중..." : "파티 시작하기"}
          </Button>
          {participantCount < 2 && (
            <Typography variant="caption" color="text.secondary" textAlign="center">
              파티를 시작하려면 최소 2명의 참가자가 필요합니다.
            </Typography>
          )}
        </Box>
      )}

      {party.status === "in_progress" && (
        <Alert severity="warning">
          파티가 진행 중입니다. 잠시 후 결과를 확인하세요.
        </Alert>
      )}

      {party.status === "completed" && (
        <Button
          variant="contained"
          startIcon={<AssessmentIcon />}
          onClick={() => router.push(`/parties/${id}/results`)}
          fullWidth
          size="large"
        >
          파티 결과 보기
        </Button>
      )}

      {/* 참가 확인 다이얼로그 */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>파티 참가 확인</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{party.name}</strong> 파티에 참가하시겠습니까?
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            파티가 시작되면 AI 에이전트가 당신의 프로필을 기반으로
            다른 참가자들과 자동으로 대화를 나눕니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>취소</Button>
          <Button onClick={confirmJoin} variant="contained" autoFocus>
            참가하기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
