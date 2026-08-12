"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";

/**
 * 불러오기 실패를 화면에 드러낸다.
 *
 * 예전에는 세 화면 모두 `catch → console.error`로 삼키고 "조건에 맞는 X가 없습니다"를 그렸다
 * (2026-08-12 실측: 백엔드를 끊으면 사용자 0명이라고 표시). 관리자 화면에서 장애를 빈 목록으로
 * 위장하는 건 하드코딩된 "정상"과 같은 종류의 거짓말이다.
 */
export default function LoadError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          다시 시도
        </Button>
      }
    >
      {message || "불러오지 못했습니다."}
    </Alert>
  );
}
