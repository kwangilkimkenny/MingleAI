"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Skeleton from "@mui/material/Skeleton";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CancelIcon from "@mui/icons-material/Cancel";
import EventIcon from "@mui/icons-material/Event";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import {
  getReservations,
  cancelReservation,
  type Reservation,
} from "@/lib/api/reservations";

export default function ReservationsPage() {
  const router = useRouter();
  const profileId = useAuthStore((s) => s.profileId);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  const loadReservations = async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const { reservations } = await getReservations(profileId);
      setReservations(reservations);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, [profileId]);

  const handleCancel = async (id: string) => {
    if (!profileId) return;
    if (!confirm("예약을 취소하시겠습니까?")) return;

    try {
      await cancelReservation(id, profileId);
      loadReservations();
    } catch (error) {
      console.error(error);
      alert("예약 취소에 실패했습니다");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string): "success" | "error" | "info" => {
    switch (status) {
      case "confirmed":
        return "success";
      case "cancelled":
        return "error";
      case "attended":
        return "info";
      default:
        return "info";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return "확정";
      case "cancelled":
        return "취소됨";
      case "attended":
        return "참석완료";
      default:
        return status;
    }
  };

  const now = new Date();
  const upcomingReservations = reservations.filter(
    (r) =>
      r.status === "confirmed" && new Date(r.party.scheduledAt) > now,
  );
  const pastReservations = reservations.filter(
    (r) =>
      r.status !== "confirmed" || new Date(r.party.scheduledAt) <= now,
  );

  const displayReservations = tab === 0 ? upcomingReservations : pastReservations;

  if (!profileId) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={700} mb={4}>
          내 예약
        </Typography>
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => router.push("/profile/create")}
            >
              프로필 만들기
            </Button>
          }
        >
          예약을 확인하려면 먼저 프로필을 만들어주세요.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        내 예약
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        파티 예약 내역을 관리하세요
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        sx={{ mb: 3 }}
      >
        <Tab label={`예정된 예약 (${upcomingReservations.length})`} />
        <Tab label={`지난 예약 (${pastReservations.length})`} />
      </Tabs>

      {loading ? (
        <Card>
          <CardContent>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={70} sx={{ mb: 1 }} />
            ))}
          </CardContent>
        </Card>
      ) : displayReservations.length === 0 ? (
        <Box textAlign="center" py={8}>
          <EventIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {tab === 0 ? "예정된 예약이 없습니다" : "지난 예약이 없습니다"}
          </Typography>
          {tab === 0 && (
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              onClick={() => router.push("/parties/discover")}
            >
              파티 둘러보기
            </Button>
          )}
        </Box>
      ) : (
        <Card>
          <List>
            {displayReservations.map((reservation) => (
              <ListItem
                key={reservation.id}
                sx={{
                  borderBottom: 1,
                  borderColor: "divider",
                  "&:last-child": { borderBottom: 0 },
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                }}
                onClick={() => router.push(`/parties/${reservation.partyId}`)}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography fontWeight={600}>
                        {reservation.party.name}
                      </Typography>
                      {reservation.party.theme && (
                        <Chip
                          label={reservation.party.theme}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      <Chip
                        label={getStatusLabel(reservation.status)}
                        size="small"
                        color={getStatusColor(reservation.status)}
                      />
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        component="span"
                      >
                        {formatDate(reservation.party.scheduledAt)}
                      </Typography>
                      {reservation.party.location && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          component="span"
                        >
                          {" · "}
                          {reservation.party.location}
                        </Typography>
                      )}
                    </>
                  }
                />
                {reservation.status === "confirmed" &&
                  new Date(reservation.party.scheduledAt) > now && (
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(reservation.id);
                        }}
                      >
                        <CancelIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
              </ListItem>
            ))}
          </List>
        </Card>
      )}
    </Box>
  );
}
