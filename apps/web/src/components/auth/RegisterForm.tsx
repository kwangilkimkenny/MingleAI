"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import NextLink from "next/link";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { register } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/store/auth";

export default function RegisterForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    try {
      const res = await register(email, password);
      setAuth({ token: res.accessToken, refreshToken: res.refreshToken, role: res.role });
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "회원가입에 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
      <Typography variant="h4" fontWeight={700} mb={3} textAlign="center">
        회원가입
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <TextField
        label="이메일"
        type="email"
        fullWidth
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        sx={{ mb: 2 }}
      />
      <TextField
        label="비밀번호"
        type="password"
        fullWidth
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        helperText="8자 이상 입력해주세요"
        sx={{ mb: 2 }}
      />
      <TextField
        label="비밀번호 확인"
        type="password"
        fullWidth
        required
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        sx={{ mb: 3 }}
      />
      <FormControlLabel
        sx={{ alignItems: "flex-start", mb: 2 }}
        control={<Checkbox checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} />}
        label={<Typography variant="body2"><Link component={NextLink} href="/terms">이용약관</Link>과 <Link component={NextLink} href="/privacy">개인정보 처리 안내</Link>에 동의합니다.</Typography>}
      />
      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading || !legalAccepted}
      >
        {loading ? "가입 중..." : "회원가입"}
      </Button>
      <Typography variant="body2" textAlign="center" mt={2}>
        이미 계정이 있으신가요?{" "}
        <Link component={NextLink} href="/login">
          로그인
        </Link>
      </Typography>
    </Box>
  );
}
