"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid2";
import GroupsIcon from "@mui/icons-material/Groups";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import FavoriteIcon from "@mui/icons-material/Favorite";
import SecurityIcon from "@mui/icons-material/Security";

/**
 * 공개 소개 페이지.
 *
 * ⚠️ 여기 적는 것은 전부 **지금 동작하는 기능**이어야 한다. 2026-08-07 감사 시점에 이 페이지는
 * 삭제된 v1 기능(AI 에이전트가 대신 대화 / 가상 소셜 파티 / AI 호환성 리포트)을 광고하고 있었고,
 * 로그인 후에는 존재하지 않는 `/dashboard`로 보냈다. 기능을 지우면 이 문구도 같이 지운다.
 */
const FEATURES = [
  {
    icon: <GroupsIcon sx={{ fontSize: 48 }} />,
    title: "여섯 명이 모이면 시작",
    description: "남성 3명·여성 3명이 모이면 한 자리가 열리고, 돌아가며 대화합니다.",
  },
  {
    icon: <RecordVoiceOverIcon sx={{ fontSize: 48 }} />,
    title: "얼굴보다 대화가 먼저",
    description: "가면 대화(음성 변조) → 목소리 공개 → 얼굴 공개 순으로 단계적으로 열립니다.",
  },
  {
    icon: <FavoriteIcon sx={{ fontSize: 48 }} />,
    title: "서로 골랐을 때만 매칭",
    description: "라운드가 끝나면 비공개로 한 명을 고르고, 둘 다 골랐을 때만 채팅이 열립니다.",
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 48 }} />,
    title: "본인인증과 신고·차단",
    description: "본인인증을 마친 성인만 참여하고, 언제든 신고하거나 차단할 수 있습니다.",
  },
];

export default function Home() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    // 로그인 상태면 프로필로. (v1의 /dashboard는 제거됐다 — 여기로 보내면 404다.)
    if (token) {
      router.replace("/profile");
    }
  }, [token, router]);

  if (token) {
    return null;
  }

  return (
    <Box>
      {/* 히어로 섹션 */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #A63D5A 0%, #1A120C 100%)",
          color: "white",
          py: { xs: 8, md: 12 },
          textAlign: "center",
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h2"
            fontWeight={800}
            mb={2}
            sx={{ fontSize: { xs: "2.5rem", md: "3.5rem" } }}
          >
            mingles
          </Typography>
          <Typography
            variant="h5"
            mb={4}
            sx={{ opacity: 0.9, fontSize: { xs: "1.1rem", md: "1.5rem" } }}
          >
            한자리에서 여러 사람과 돌아가며, 얼굴보다 대화로 먼저
          </Typography>
          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
            <Button
              variant="contained"
              size="large"
              onClick={() => router.push("/login")}
              sx={{
                bgcolor: "white",
                color: "primary.main",
                "&:hover": { bgcolor: "grey.100" },
                px: 4,
                py: 1.5,
              }}
            >
              로그인
            </Button>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 3 }}>
            소개팅은 mingles 앱에서 진행됩니다. 웹에서는 프로필·데이트 계획·알림을 볼 수 있어요.
          </Typography>
        </Container>
      </Box>

      {/* 기능 섹션 */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Typography variant="h4" fontWeight={700} textAlign="center" mb={6}>
          어떻게 진행되나요?
        </Typography>
        <Grid container spacing={4}>
          {FEATURES.map((feature) => (
            <Grid key={feature.title} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ height: "100%", textAlign: "center" }}>
                <CardContent sx={{ py: 4 }}>
                  <Box color="primary.main" mb={2}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h6" fontWeight={600} mb={1}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* 푸터 */}
      <Box sx={{ bgcolor: "grey.900", color: "grey.400", py: 4, textAlign: "center" }}>
        <Typography variant="body2">
          © {new Date().getFullYear()} mingles. 로테이션 블라인드 소개팅
        </Typography>
      </Box>
    </Box>
  );
}
