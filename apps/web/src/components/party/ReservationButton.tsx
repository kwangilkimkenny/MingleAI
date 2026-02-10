"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import CheckIcon from "@mui/icons-material/Check";
import { useAuthStore } from "@/lib/store/auth";
import { createReservation } from "@/lib/api/reservations";

interface ReservationButtonProps {
  partyId: string;
  isReserved?: boolean;
  isFull?: boolean;
  disabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export default function ReservationButton({
  partyId,
  isReserved = false,
  isFull = false,
  disabled = false,
  onSuccess,
  onError,
}: ReservationButtonProps) {
  const profileId = useAuthStore((s) => s.profileId);
  const [loading, setLoading] = useState(false);
  const [reserved, setReserved] = useState(isReserved);

  const handleReserve = async () => {
    if (!profileId) {
      alert("프로필을 먼저 생성해주세요");
      return;
    }

    setLoading(true);
    try {
      await createReservation(partyId, profileId);
      setReserved(true);
      onSuccess?.();
    } catch (error) {
      console.error(error);
      onError?.(error as Error);
      alert(
        error instanceof Error ? error.message : "예약에 실패했습니다",
      );
    } finally {
      setLoading(false);
    }
  };

  if (reserved) {
    return (
      <Button
        variant="contained"
        color="success"
        startIcon={<CheckIcon />}
        disabled
      >
        예약완료
      </Button>
    );
  }

  if (isFull) {
    return (
      <Button variant="contained" disabled>
        마감
      </Button>
    );
  }

  return (
    <Button
      variant="contained"
      onClick={handleReserve}
      disabled={disabled || loading || !profileId}
      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
    >
      {loading ? "예약 중..." : "예약하기"}
    </Button>
  );
}
