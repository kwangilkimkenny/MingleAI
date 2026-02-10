"use client";

import { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CancelIcon from "@mui/icons-material/Cancel";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import {
  getUpcomingReservations,
  cancelReservation,
  type Reservation,
} from "@/lib/api/reservations";

export default function UpcomingReservations() {
  const router = useRouter();
  const profileId = useAuthStore((s) => s.profileId);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReservations = async () => {
    if (!profileId) return;

    try {
      const data = await getUpcomingReservations(profileId, 5);
      setReservations(data);
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
    const now = new Date();
    const diffDays = Math.ceil(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    const timeStr = date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (diffDays === 0) {
      return `오늘 ${timeStr}`;
    } else if (diffDays === 1) {
      return `내일 ${timeStr}`;
    } else {
      return date.toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="다가오는 예약" />
        <CardContent>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={60} sx={{ mb: 1 }} />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="다가오는 예약"
        action={
          <Button size="small" onClick={() => router.push("/reservations")}>
            전체보기
          </Button>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {reservations.length === 0 ? (
          <Box textAlign="center" py={3}>
            <Typography color="text.secondary">
              예정된 예약이 없습니다
            </Typography>
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              onClick={() => router.push("/parties")}
            >
              파티 예약하기
            </Button>
          </Box>
        ) : (
          <List disablePadding>
            {reservations.map((reservation) => (
              <ListItem
                key={reservation.id}
                sx={{
                  px: 0,
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                  borderRadius: 1,
                }}
                onClick={() => router.push(`/parties/${reservation.partyId}`)}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      {reservation.party.name}
                      {reservation.party.theme && (
                        <Chip
                          label={reservation.party.theme}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                  secondary={formatDate(reservation.party.scheduledAt)}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancel(reservation.id);
                    }}
                  >
                    <CancelIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
