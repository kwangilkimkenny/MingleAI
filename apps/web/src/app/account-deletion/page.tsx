"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { deleteAccount, login } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/store/auth";

export default function AccountDeletionPage() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (confirmation.trim() !== "탈퇴") return;
    setBusy(true);
    setError("");
    try {
      const session = await login(email.trim(), password);
      setAuth({ token: session.accessToken, refreshToken: session.refreshToken, role: session.role });
      await deleteAccount(password);
      logout();
      setDeleted(true);
    } catch (reason) {
      logout();
      setError(reason instanceof Error ? reason.message : "계정을 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 5, md: 8 } }}>
      <Link component={NextLink} href="/">MingleAI</Link>
      <Typography component="h1" variant="h3" fontWeight={800} sx={{ mt: 2 }}>계정 삭제</Typography>
      <Typography color="text.secondary" sx={{ mt: 2, mb: 4 }}>앱을 설치하지 않아도 여기에서 계정과 연결 데이터를 영구 삭제할 수 있습니다.</Typography>
      {deleted ? <Alert severity="success">계정이 삭제되었습니다.</Alert> : (
        <Box component="form" onSubmit={submit} sx={{ display: "grid", gap: 2 }}>
          <Alert severity="warning">프로필, 매칭, 프로포즈, 채팅, 데이트 계획과 게임 참여 기록은 삭제 후 복구할 수 없습니다.</Alert>
          <TextField required label="이메일" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <TextField required label="현재 비밀번호" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <TextField required label="확인 문구" helperText="계속하려면 ‘탈퇴’를 입력하세요." value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button color="error" variant="contained" size="large" type="submit" disabled={busy || !email || !password || confirmation.trim() !== "탈퇴"}>{busy ? "삭제 중..." : "계정 영구 삭제"}</Button>
        </Box>
      )}
    </Container>
  );
}
