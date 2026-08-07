"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Link from "next/link";

/**
 * 웹에는 회원가입이 없다.
 *
 * 예전에는 이메일·비밀번호 가입 폼이 있었지만 2026-07-22 소셜 전용 전환으로 `/auth/register`
 * 자체가 백엔드에서 사라졌다 — 폼은 남아 있었고 누르면 404였다(가짜 정보 감사 2026-08-07).
 * 가입은 앱에서 소셜 로그인 + 본인인증으로만 이뤄진다.
 */
export default function RegisterPage() {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      sx={{ bgcolor: "background.default" }}
    >
      <Card sx={{ maxWidth: 460, width: "100%", mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={700} mb={2}>
            가입은 앱에서 진행돼요
          </Typography>
          <Typography color="text.secondary" mb={3}>
            mingles는 카카오·네이버·구글 계정으로 로그인하고, 본인인증을 마친 성인만 참여합니다.
            웹에서는 계정을 만들 수 없어요.
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            앱을 설치한 뒤 소셜 로그인 → 본인인증 → 프로필 작성 순서로 진행됩니다.
          </Alert>
          <Button component={Link} href="/" variant="outlined" fullWidth>
            소개 페이지로
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
