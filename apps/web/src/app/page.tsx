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
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CelebrationIcon from "@mui/icons-material/Celebration";
import FavoriteIcon from "@mui/icons-material/Favorite";
import SecurityIcon from "@mui/icons-material/Security";

const FEATURES = [
  {
    icon: <SmartToyIcon sx={{ fontSize: 48 }} />,
    title: "AI 에이전트",
    description: "당신의 프로필을 기반으로 AI 에이전트가 파티에서 대화합니다.",
  },
  {
    icon: <CelebrationIcon sx={{ fontSize: 48 }} />,
    title: "가상 소셜 파티",
    description: "다양한 테마의 파티에서 새로운 인연을 만나보세요.",
  },
  {
    icon: <FavoriteIcon sx={{ fontSize: 48 }} />,
    title: "스마트 매칭",
    description: "AI가 분석한 호환성 리포트로 최적의 매칭을 찾아드립니다.",
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 48 }} />,
    title: "안전한 만남",
    description: "실제 연락처 교환 없이 안전하게 상대방을 알아가세요.",
  },
];

export default function Home() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    // 이미 로그인된 경우 대시보드로 이동
    if (token) {
      router.replace("/dashboard");
    }
  }, [token, router]);

  // 로그인된 경우 대시보드로 리다이렉트 중
  if (token) {
    return null;
  }

  return (
    <Box>
      {/* 히어로 섹션 */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #E91E63 0%, #FF6F00 100%)",
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
            MingleAI
          </Typography>
          <Typography
            variant="h5"
            mb={4}
            sx={{ opacity: 0.9, fontSize: { xs: "1.1rem", md: "1.5rem" } }}
          >
            AI 에이전트가 당신을 대신해 새로운 인연을 찾아드립니다
          </Typography>
          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
            <Button
              variant="contained"
              size="large"
              onClick={() => router.push("/register")}
              sx={{
                bgcolor: "white",
                color: "primary.main",
                "&:hover": { bgcolor: "grey.100" },
                px: 4,
                py: 1.5,
              }}
            >
              무료로 시작하기
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => router.push("/login")}
              sx={{
                borderColor: "white",
                color: "white",
                "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" },
                px: 4,
                py: 1.5,
              }}
            >
              로그인
            </Button>
          </Box>
        </Container>
      </Box>

      {/* 서비스 소개 */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h4" fontWeight={700} textAlign="center" mb={6}>
          어떻게 작동하나요?
        </Typography>

        <Grid container spacing={4}>
          {FEATURES.map((feature, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
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

      {/* CTA 섹션 */}
      <Box sx={{ bgcolor: "grey.100", py: 8 }}>
        <Container maxWidth="sm" sx={{ textAlign: "center" }}>
          <Typography variant="h4" fontWeight={700} mb={2}>
            지금 바로 시작하세요
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={4}>
            프로필을 만들고, 파티에 참가하고, 새로운 인연을 찾아보세요.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => router.push("/register")}
            sx={{ px: 6, py: 1.5 }}
          >
            회원가입
          </Button>
        </Container>
      </Box>

      {/* 푸터 */}
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          © 2025 MingleAI. AI-Powered Social Matching Platform.
        </Typography>
      </Box>
    </Box>
  );
}
