"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid2";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "@mui/material/Avatar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonIcon from "@mui/icons-material/Person";
import { getAdminPartyDetail, updateAdminParty, type AdminPartyDetail } from "@/lib/api/admin";

export default function AdminPartyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const partyId = params.id as string;

  const [party, setParty] = useState<AdminPartyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (partyId) {
      getAdminPartyDetail(partyId)
        .then(setParty)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [partyId]);

  const handleStatusChange = async (status: string) => {
    if (!party) return;

    try {
      await updateAdminParty(party.id, { status });
      setParty({ ...party, status });
    } catch (error) {
      console.error(error);
      alert("상태 변경에 실패했습니다");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string): "primary" | "warning" | "success" | "error" | "default" => {
    switch (status) {
      case "scheduled":
        return "primary";
      case "in_progress":
        return "warning";
      case "completed":
        return "success";
      case "cancelled":
        return "error";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "scheduled":
        return "예정";
      case "in_progress":
        return "진행중";
      case "completed":
        return "완료";
      case "cancelled":
        return "취소";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton height={40} width={200} sx={{ mb: 2 }} />
        <Skeleton height={200} />
      </Box>
    );
  }

  if (!party) {
    return (
      <Box textAlign="center" py={8}>
        <Typography>파티를 찾을 수 없습니다</Typography>
        <Button onClick={() => router.push("/admin/parties")} sx={{ mt: 2 }}>
          목록으로
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push("/admin/parties")}
        >
          목록으로
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Typography variant="h5" fontWeight={600}>
              {party.name}
            </Typography>
            <Chip
              label={getStatusLabel(party.status)}
              color={getStatusColor(party.status)}
            />
            {party.theme && (
              <Chip label={party.theme} variant="outlined" />
            )}
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                일시
              </Typography>
              <Typography variant="body2">
                {formatDate(party.scheduledAt)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                지역
              </Typography>
              <Typography variant="body2">{party.location ?? "-"}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                참가자
              </Typography>
              <Typography variant="body2">
                {party.participants.length} / {party.maxParticipants}명
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                연령 제한
              </Typography>
              <Typography variant="body2">
                {party.ageMin || "-"} ~ {party.ageMax || "-"}세
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                라운드
              </Typography>
              <Typography variant="body2">
                {party.roundCount}회 / 각 {party.roundDurationMinutes}분
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Box display="flex" gap={2} mb={3}>
        {party.status === "scheduled" && (
          <>
            <Button
              variant="contained"
              color="warning"
              onClick={() => handleStatusChange("in_progress")}
            >
              파티 시작
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => handleStatusChange("cancelled")}
            >
              파티 취소
            </Button>
          </>
        )}
        {party.status === "in_progress" && (
          <>
            <Button
              variant="contained"
              onClick={() => router.push(`/admin/parties/${party.id}/monitor`)}
            >
              실시간 모니터링
            </Button>
            <Button
              variant="outlined"
              color="success"
              onClick={() => handleStatusChange("completed")}
            >
              파티 종료
            </Button>
          </>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="참가자"
              subheader={`${party.participants.length}명`}
            />
            <CardContent sx={{ maxHeight: 400, overflow: "auto" }}>
              {party.participants.length === 0 ? (
                <Typography color="text.secondary">
                  참가자가 없습니다
                </Typography>
              ) : (
                <List dense>
                  {party.participants.map((p) => (
                    <ListItem key={p.profile.id}>
                      <ListItemAvatar>
                        <Avatar>
                          <PersonIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={p.profile.name}
                        secondary={`${p.profile.age}세 / ${p.profile.gender}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title="예약"
              subheader={`${party.reservations.length}명`}
            />
            <CardContent sx={{ maxHeight: 400, overflow: "auto" }}>
              {party.reservations.length === 0 ? (
                <Typography color="text.secondary">예약이 없습니다</Typography>
              ) : (
                <List dense>
                  {party.reservations.map((r) => (
                    <ListItem key={r.id}>
                      <ListItemAvatar>
                        <Avatar>
                          <PersonIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={r.profile.name}
                        secondary={`${r.profile.age}세 / ${r.profile.gender}`}
                      />
                      <Chip
                        label={r.status}
                        size="small"
                        color={r.status === "confirmed" ? "success" : "default"}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
