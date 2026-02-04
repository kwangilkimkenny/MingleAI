"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";

interface DatePlanFormProps {
  onSubmit: (data: {
    profileId1: string;
    profileId2: string;
    budget: { total: number; currency: string };
    location: { city: string; district?: string; maxTravelMinutes?: number };
    dateTime: { preferredDate: string; durationHours?: number };
    preferences?: {
      cuisineTypes?: string[];
      activityTypes?: string[];
      avoidTypes?: string[];
    };
  }) => Promise<void>;
  defaultProfileId?: string | null;
}

export default function DatePlanForm({
  onSubmit,
  defaultProfileId,
}: DatePlanFormProps) {
  const [profileId1, setProfileId1] = useState(defaultProfileId || "");
  const [profileId2, setProfileId2] = useState("");
  const [budget, setBudget] = useState(100000);
  const [currency, setCurrency] = useState("KRW");
  const [city, setCity] = useState("서울");
  const [district, setDistrict] = useState("");
  const [maxTravel, setMaxTravel] = useState(30);
  const [preferredDate, setPreferredDate] = useState("");
  const [durationHours, setDurationHours] = useState(3);
  const [cuisineTypes, setCuisineTypes] = useState("");
  const [activityTypes, setActivityTypes] = useState("");
  const [avoidTypes, setAvoidTypes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const splitTags = (s: string) =>
    s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId1 || !profileId2 || !preferredDate) return;
    setError("");
    setLoading(true);
    try {
      await onSubmit({
        profileId1,
        profileId2,
        budget: { total: budget, currency },
        location: {
          city,
          district: district || undefined,
          maxTravelMinutes: maxTravel,
        },
        dateTime: {
          preferredDate: new Date(preferredDate).toISOString(),
          durationHours,
        },
        preferences: {
          cuisineTypes: splitTags(cuisineTypes),
          activityTypes: splitTags(activityTypes),
          avoidTypes: splitTags(avoidTypes),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="subtitle1" fontWeight={600} mb={2}>
        참가자
      </Typography>
      <Box display="flex" flexDirection="column" gap={2} mb={3}>
        <TextField
          label="내 프로필 ID"
          required
          value={profileId1}
          onChange={(e) => setProfileId1(e.target.value)}
        />
        <TextField
          label="상대 프로필 ID"
          required
          value={profileId2}
          onChange={(e) => setProfileId2(e.target.value)}
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" fontWeight={600} mb={2}>
        예산
      </Typography>
      <Box display="flex" gap={2} mb={3}>
        <TextField
          label="총 예산"
          type="number"
          required
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          sx={{ flexGrow: 1 }}
        />
        <TextField
          label="통화"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          sx={{ width: 100 }}
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" fontWeight={600} mb={2}>
        장소
      </Typography>
      <Box display="flex" flexDirection="column" gap={2} mb={3}>
        <TextField
          label="도시"
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <TextField
          label="구/동 (선택)"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
        />
        <TextField
          label="최대 이동 시간 (분)"
          type="number"
          value={maxTravel}
          onChange={(e) => setMaxTravel(Number(e.target.value))}
          slotProps={{ htmlInput: { min: 5, max: 120 } }}
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" fontWeight={600} mb={2}>
        일시
      </Typography>
      <Box display="flex" gap={2} mb={3}>
        <TextField
          label="선호 날짜"
          type="datetime-local"
          required
          value={preferredDate}
          onChange={(e) => setPreferredDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ flexGrow: 1 }}
        />
        <TextField
          label="시간 (시)"
          type="number"
          value={durationHours}
          onChange={(e) => setDurationHours(Number(e.target.value))}
          slotProps={{ htmlInput: { min: 1, max: 12 } }}
          sx={{ width: 120 }}
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" fontWeight={600} mb={2}>
        선호 사항 (쉼표로 구분)
      </Typography>
      <Box display="flex" flexDirection="column" gap={2} mb={3}>
        <TextField
          label="선호 음식"
          value={cuisineTypes}
          onChange={(e) => setCuisineTypes(e.target.value)}
          placeholder="예: 한식, 이탈리안, 일식"
        />
        <TextField
          label="선호 활동"
          value={activityTypes}
          onChange={(e) => setActivityTypes(e.target.value)}
          placeholder="예: 카페, 산책, 전시회"
        />
        <TextField
          label="피하고 싶은 것"
          value={avoidTypes}
          onChange={(e) => setAvoidTypes(e.target.value)}
          placeholder="예: 술집, 노래방"
        />
      </Box>

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading || !profileId1 || !profileId2 || !preferredDate}
      >
        {loading ? "생성 중..." : "데이트 코스 생성"}
      </Button>
    </Box>
  );
}
