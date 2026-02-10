"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid2";
import Avatar from "@mui/material/Avatar";
import PersonIcon from "@mui/icons-material/Person";

interface Profile {
  id: string;
  name: string;
  age: number;
  gender: string;
  location: string;
  occupation?: string;
  bio?: string;
  status: string;
  riskScore: number;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  profile?: Profile | null;
}

interface UserDetailCardProps {
  user: User;
}

export default function UserDetailCard({ user }: UserDetailCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string): "success" | "error" | "warning" | "default" => {
    switch (status) {
      case "active":
        return "success";
      case "suspended":
        return "error";
      case "deleted":
        return "default";
      default:
        return "warning";
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 0.7) return "error";
    if (score >= 0.4) return "warning";
    return "success";
  };

  return (
    <Card>
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: "primary.main", width: 56, height: 56 }}>
            <PersonIcon fontSize="large" />
          </Avatar>
        }
        title={
          <Typography variant="h5" fontWeight={600}>
            {user.profile?.name ?? user.email}
          </Typography>
        }
        subheader={user.email}
        action={
          user.profile && (
            <Chip
              label={user.profile.status}
              color={getStatusColor(user.profile.status)}
            />
          )
        }
      />
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          계정 정보
        </Typography>
        <Grid container spacing={2} mb={3}>
          <Grid size={{ xs: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              역할
            </Typography>
            <Typography variant="body2">{user.role}</Typography>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              가입일
            </Typography>
            <Typography variant="body2">{formatDate(user.createdAt)}</Typography>
          </Grid>
        </Grid>

        {user.profile && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              프로필 정보
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  나이
                </Typography>
                <Typography variant="body2">{user.profile.age}세</Typography>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  성별
                </Typography>
                <Typography variant="body2">{user.profile.gender}</Typography>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  지역
                </Typography>
                <Typography variant="body2">{user.profile.location}</Typography>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  직업
                </Typography>
                <Typography variant="body2">
                  {user.profile.occupation ?? "-"}
                </Typography>
              </Grid>
            </Grid>

            {user.profile.bio && (
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">
                  자기소개
                </Typography>
                <Typography variant="body2">{user.profile.bio}</Typography>
              </Box>
            )}

            <Box mt={2}>
              <Typography variant="caption" color="text.secondary">
                위험 점수
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2">
                  {(user.profile.riskScore * 100).toFixed(0)}%
                </Typography>
                <Chip
                  label={
                    user.profile.riskScore >= 0.7
                      ? "높음"
                      : user.profile.riskScore >= 0.4
                        ? "중간"
                        : "낮음"
                  }
                  size="small"
                  color={getRiskColor(user.profile.riskScore)}
                />
              </Box>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
