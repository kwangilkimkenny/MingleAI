"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { useAuthStore } from "@/lib/store/auth";

export default function MyProfilePage() {
  const router = useRouter();
  const profileId = useAuthStore((s) => s.profileId);

  useEffect(() => {
    // 프로필이 있으면 해당 프로필 페이지로 리다이렉트
    if (profileId) {
      router.replace(`/profile/${profileId}`);
    }
  }, [profileId, router]);

  // 프로필이 있으면 리다이렉트 중
  if (profileId) {
    return <LoadingSpinner message="프로필로 이동 중..." />;
  }

  // 프로필이 없는 경우 생성 안내
  return (
    <Container maxWidth="sm">
      <Box py={8} textAlign="center">
        <SmartToyIcon sx={{ fontSize: 80, color: "primary.main", mb: 3 }} />
        <Typography variant="h4" fontWeight={700} mb={2}>
          아직 프로필이 없어요
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          AI 에이전트가 파티에서 당신을 대신해 대화하려면 먼저 프로필을 만들어야
          합니다. 프로필에는 당신의 성격, 관심사, 이상형 등이 담깁니다.
        </Typography>

        <Card sx={{ mb: 4, textAlign: "left" }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} mb={2}>
              프로필에 담기는 정보
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              <li>
                <Typography variant="body2" color="text.secondary">
                  기본 정보 (이름, 나이, 성별, 지역)
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  매칭 선호도 (원하는 연령대, 성별, 거리)
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  가치관 (관계 목표, 라이프스타일, 중요 가치)
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  소통 스타일 (대화 톤, 관심 토픽)
                </Typography>
              </li>
            </Box>
          </CardContent>
        </Card>

        <Button
          variant="contained"
          size="large"
          startIcon={<PersonAddIcon />}
          onClick={() => router.push("/profile/create")}
          sx={{ px: 6, py: 1.5 }}
        >
          프로필 만들기
        </Button>
      </Box>
    </Container>
  );
}
