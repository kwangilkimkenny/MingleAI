"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Grid from "@mui/material/Grid2";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CelebrationIcon from "@mui/icons-material/Celebration";
import AssessmentIcon from "@mui/icons-material/Assessment";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EventIcon from "@mui/icons-material/Event";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { useAuthStore } from "@/lib/store/auth";
import StatsCard from "@/components/dashboard/StatsCard";
import MyPartiesSection from "@/components/dashboard/MyPartiesSection";
import UpcomingReservations from "@/components/dashboard/UpcomingReservations";
import { getDashboardSummary, type DashboardSummary } from "@/lib/api/dashboard";

const QUICK_ACTIONS = [
  {
    label: "프로필 만들기",
    description: "AI 에이전트가 될 나의 프로필을 생성합니다",
    icon: <PersonAddIcon sx={{ fontSize: 40 }} />,
    path: "/profile/create",
    requiresNoProfile: true,
  },
  {
    label: "내 프로필 보기",
    description: "생성된 프로필을 확인하고 수정합니다",
    icon: <PersonAddIcon sx={{ fontSize: 40 }} />,
    path: "/profile",
    requiresProfile: true,
  },
  {
    label: "파티 둘러보기",
    description: "참가 가능한 파티를 찾아보세요",
    icon: <CelebrationIcon sx={{ fontSize: 40 }} />,
    path: "/parties",
  },
  {
    label: "매칭 리포트",
    description: "파티 결과를 바탕으로 매칭 리포트를 확인합니다",
    icon: <AssessmentIcon sx={{ fontSize: 40 }} />,
    path: "/reports",
    requiresProfile: true,
  },
  {
    label: "데이트 코스",
    description: "매칭된 상대와의 데이트 코스를 추천받습니다",
    icon: <FavoriteIcon sx={{ fontSize: 40 }} />,
    path: "/date-plans/create",
    requiresProfile: true,
  },
];

const ONBOARDING_STEPS = [
  { label: "회원가입", completed: true },
  { label: "프로필 생성", completed: false },
  { label: "파티 참가", completed: false },
  { label: "매칭 확인", completed: false },
];

export default function DashboardPage() {
  const router = useRouter();
  const profileId = useAuthStore((s) => s.profileId);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    if (profileId) {
      getDashboardSummary(profileId)
        .then(setSummary)
        .catch(console.error);
    }
  }, [profileId]);

  const steps = ONBOARDING_STEPS.map((step, index) => ({
    ...step,
    completed: index === 0 ? true : index === 1 ? !!profileId : false,
  }));
  const activeStep = profileId ? 2 : 1;

  const visibleActions = QUICK_ACTIONS.filter((action) => {
    if (action.requiresNoProfile && profileId) return false;
    if (action.requiresProfile && !profileId) return false;
    return true;
  });

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        안녕하세요!
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        MingleAI에 오신 것을 환영합니다. AI 에이전트가 당신을 대신해 소셜
        매칭에 참여합니다.
      </Typography>

      {/* 온보딩 스테퍼 */}
      {!profileId && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={3}>
              시작하기
            </Typography>
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((step) => (
                <Step key={step.label} completed={step.completed}>
                  <StepLabel
                    StepIconComponent={step.completed ? () => <CheckCircleIcon color="success" /> : undefined}
                  >
                    {step.label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>
      )}

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
          아직 프로필이 없습니다. 파티에 참가하려면 먼저 프로필을 만들어주세요.
        </Alert>
      )}

      {profileId && (
        <Alert severity="success" sx={{ mb: 4 }} icon={<CheckCircleIcon />}>
          프로필이 활성화되었습니다! 이제 파티에 참가할 수 있습니다.
        </Alert>
      )}

      {/* 통계 카드 - 프로필이 있는 경우에만 표시 */}
      {profileId && summary && (
        <Grid container spacing={3} mb={4}>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatsCard
              title="예정된 예약"
              value={summary.upcomingReservations}
              icon={EventIcon}
              color="primary"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatsCard
              title="참여한 파티"
              value={summary.completedParties}
              icon={CelebrationIcon}
              color="success"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatsCard
              title="매칭 결과"
              value={summary.totalMatches}
              icon={FavoriteIcon}
              color="error"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatsCard
              title="알림"
              value={summary.unreadNotifications}
              icon={NotificationsIcon}
              color="warning"
            />
          </Grid>
        </Grid>
      )}

      {/* 예약 및 파티 위젯 - 프로필이 있는 경우에만 표시 */}
      {profileId && (
        <Grid container spacing={3} mb={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <UpcomingReservations />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <MyPartiesSection />
          </Grid>
        </Grid>
      )}

      <Typography variant="h6" fontWeight={600} mb={2}>
        빠른 시작
      </Typography>
      <Grid container spacing={3}>
        {visibleActions.map((action) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={action.path}>
            <Card sx={{ height: "100%" }}>
              <CardActionArea
                onClick={() => router.push(action.path)}
                sx={{ height: "100%" }}
              >
                <CardContent
                  sx={{
                    textAlign: "center",
                    py: 4,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
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

      {/* 사용 안내 */}
      <Box mt={6}>
        <Typography variant="h6" fontWeight={600} mb={2}>
          MingleAI 이용 방법
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>
                  1. 프로필 만들기
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  당신의 성격, 관심사, 이상형 정보를 입력하면 AI 에이전트가
                  생성됩니다.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>
                  2. 파티 참가하기
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  다양한 테마의 파티 중 마음에 드는 파티를 선택하여
                  참가 신청하세요.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>
                  3. 매칭 결과 확인
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  파티가 끝나면 AI가 분석한 호환성 리포트로 최적의 매칭을
                  확인하세요.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
