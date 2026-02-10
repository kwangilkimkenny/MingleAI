"use client";

import { useEffect, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Box from "@mui/material/Box";
import CelebrationIcon from "@mui/icons-material/Celebration";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import { getMyParties, type MyParty } from "@/lib/api/dashboard";

export default function MyPartiesSection() {
  const router = useRouter();
  const profileId = useAuthStore((s) => s.profileId);
  const [parties, setParties] = useState<MyParty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;

    getMyParties(profileId, 5)
      .then((res) => setParties(res.parties))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [profileId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "primary";
      case "in_progress":
        return "warning";
      case "completed":
        return "success";
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
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="내 파티" />
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
        title="내 파티"
        action={
          <Button size="small" onClick={() => router.push("/parties")}>
            전체보기
          </Button>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {parties.length === 0 ? (
          <Box textAlign="center" py={3}>
            <Typography color="text.secondary">
              참여한 파티가 없습니다
            </Typography>
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              onClick={() => router.push("/parties")}
            >
              파티 둘러보기
            </Button>
          </Box>
        ) : (
          <List disablePadding>
            {parties.map((party) => (
              <ListItem
                key={party.id}
                sx={{
                  px: 0,
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                  borderRadius: 1,
                }}
                onClick={() => router.push(`/parties/${party.id}`)}
              >
                <ListItemIcon>
                  <CelebrationIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={party.name}
                  secondary={formatDate(party.scheduledAt)}
                />
                <Chip
                  label={getStatusLabel(party.status)}
                  size="small"
                  color={getStatusColor(party.status)}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
