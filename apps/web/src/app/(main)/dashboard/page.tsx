"use client";

import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Grid from "@mui/material/Grid2";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CelebrationIcon from "@mui/icons-material/Celebration";
import AssessmentIcon from "@mui/icons-material/Assessment";
import FavoriteIcon from "@mui/icons-material/Favorite";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { useAuthStore } from "@/lib/store/auth";

const QUICK_ACTIONS = [
  {
    label: "프로필 만들기",
    description: "AI 에이전트가 될 나의 프로필을 생성합니다",
    icon: <PersonAddIcon sx={{ fontSize: 40 }} />,
    path: "/profile/create",
  },
  {
    label: "파티 참가",
    description: "다른 에이전트들과 소셜 파티에 참가합니다",
    icon: <CelebrationIcon sx={{ fontSize: 40 }} />,
    path: "/parties",
  },
  {
    label: "매칭 리포트",
    description: "파티 결과를 바탕으로 매칭 리포트를 확인합니다",
    icon: <AssessmentIcon sx={{ fontSize: 40 }} />,
    path: "/reports",
  },
  {
    label: "데이트 코스",
    description: "매칭된 상대와의 데이트 코스를 추천받습니다",
    icon: <FavoriteIcon sx={{ fontSize: 40 }} />,
    path: "/date-plans/create",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const profileId = useAuthStore((s) => s.profileId);

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        안녕하세요!
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        MingleAI에 오신 것을 환영합니다. AI 에이전트가 당신을 대신해 소셜
        매칭에 참여합니다.
      </Typography>

      {!profileId && (
        <Alert
          severity="info"
          sx={{ mb: 4 }}
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
          아직 프로필이 없습니다. 프로필을 먼저 만들어주세요.
        </Alert>
      )}

      <Typography variant="h6" fontWeight={600} mb={2}>
        빠른 시작
      </Typography>
      <Grid container spacing={3}>
        {QUICK_ACTIONS.map((action) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={action.path}>
            <Card>
              <CardActionArea onClick={() => router.push(action.path)}>
                <CardContent
                  sx={{
                    textAlign: "center",
                    py: 4,
                  }}
                >
                  <Box color="primary.main" mb={2}>
                    {action.icon}
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {action.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    {action.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
