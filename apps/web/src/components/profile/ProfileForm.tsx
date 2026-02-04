"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Slider from "@mui/material/Slider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import OutlinedInput from "@mui/material/OutlinedInput";
import {
  GENDER_LABELS,
  GENDER_PREF_LABELS,
  RELATIONSHIP_GOAL_LABELS,
  TONE_LABELS,
} from "@/lib/constants";

const STEPS = ["기본 정보", "선호도", "가치관", "소통 스타일", "확인"];

interface ProfileFormData {
  name: string;
  age: number;
  gender: string;
  location: string;
  occupation: string;
  bio: string;
  ageRange: [number, number];
  genderPreference: string[];
  locationRadius: number;
  dealbreakers: string;
  relationshipGoal: string;
  lifestyle: string;
  importantValues: string;
  tone: string;
  topics: string;
}

interface ProfileFormProps {
  initialData?: Partial<ProfileFormData>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel?: string;
}

const defaultData: ProfileFormData = {
  name: "",
  age: 25,
  gender: "",
  location: "",
  occupation: "",
  bio: "",
  ageRange: [20, 35],
  genderPreference: [],
  locationRadius: 50,
  dealbreakers: "",
  relationshipGoal: "",
  lifestyle: "",
  importantValues: "",
  tone: "",
  topics: "",
};

export default function ProfileForm({
  initialData,
  onSubmit,
  submitLabel = "프로필 생성",
}: ProfileFormProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<ProfileFormData>({
    ...defaultData,
    ...initialData,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field: keyof ProfileFormData, value: unknown) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const splitTags = (s: string) =>
    s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await onSubmit({
        name: data.name,
        age: data.age,
        gender: data.gender,
        location: data.location,
        occupation: data.occupation || undefined,
        bio: data.bio || undefined,
        preferences: {
          ageRange: { min: data.ageRange[0], max: data.ageRange[1] },
          genderPreference: data.genderPreference,
          locationRadius: data.locationRadius,
          dealbreakers: splitTags(data.dealbreakers),
        },
        values: {
          relationshipGoal: data.relationshipGoal,
          lifestyle: splitTags(data.lifestyle),
          importantValues: splitTags(data.importantValues),
        },
        communicationStyle: {
          tone: data.tone,
          topics: splitTags(data.topics),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    switch (step) {
      case 0:
        return data.name && data.age >= 19 && data.gender && data.location;
      case 1:
        return data.genderPreference.length > 0;
      case 2:
        return data.relationshipGoal && data.lifestyle && data.importantValues;
      case 3:
        return data.tone && data.topics;
      default:
        return true;
    }
  };

  return (
    <Box>
      <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {step === 0 && (
        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label="이름"
            required
            value={data.name}
            onChange={(e) => update("name", e.target.value)}
          />
          <TextField
            label="나이"
            type="number"
            required
            value={data.age}
            onChange={(e) => update("age", Number(e.target.value))}
            slotProps={{ htmlInput: { min: 19, max: 100 } }}
          />
          <TextField
            label="성별"
            select
            required
            value={data.gender}
            onChange={(e) => update("gender", e.target.value)}
          >
            {Object.entries(GENDER_LABELS).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="지역"
            required
            value={data.location}
            onChange={(e) => update("location", e.target.value)}
            placeholder="예: 서울 강남구"
          />
          <TextField
            label="직업"
            value={data.occupation}
            onChange={(e) => update("occupation", e.target.value)}
          />
          <TextField
            label="자기소개"
            multiline
            rows={3}
            value={data.bio}
            onChange={(e) => update("bio", e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            helperText={`${data.bio.length}/500`}
          />
        </Box>
      )}

      {step === 1 && (
        <Box display="flex" flexDirection="column" gap={3}>
          <Box>
            <Typography gutterBottom>선호 나이대</Typography>
            <Slider
              value={data.ageRange}
              onChange={(_, v) => update("ageRange", v)}
              min={19}
              max={80}
              valueLabelDisplay="on"
            />
          </Box>
          <FormControl fullWidth>
            <InputLabel>선호 성별</InputLabel>
            <Select
              multiple
              value={data.genderPreference}
              onChange={(e) => update("genderPreference", e.target.value)}
              input={<OutlinedInput label="선호 성별" />}
              renderValue={(selected) => (
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {(selected as string[]).map((v) => (
                    <Chip key={v} label={GENDER_PREF_LABELS[v]} size="small" />
                  ))}
                </Box>
              )}
            >
              {Object.entries(GENDER_PREF_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box>
            <Typography gutterBottom>
              매칭 반경: {data.locationRadius}km
            </Typography>
            <Slider
              value={data.locationRadius}
              onChange={(_, v) => update("locationRadius", v as number)}
              min={5}
              max={200}
              step={5}
            />
          </Box>
          <TextField
            label="딜브레이커 (쉼표로 구분)"
            value={data.dealbreakers}
            onChange={(e) => update("dealbreakers", e.target.value)}
            placeholder="예: 흡연, 반려동물 싫어하는 사람"
          />
        </Box>
      )}

      {step === 2 && (
        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label="관계 목표"
            select
            required
            value={data.relationshipGoal}
            onChange={(e) => update("relationshipGoal", e.target.value)}
          >
            {Object.entries(RELATIONSHIP_GOAL_LABELS).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="라이프스타일 (쉼표로 구분)"
            required
            value={data.lifestyle}
            onChange={(e) => update("lifestyle", e.target.value)}
            placeholder="예: 운동, 독서, 여행, 카페투어"
          />
          <TextField
            label="중요한 가치관 (쉼표로 구분)"
            required
            value={data.importantValues}
            onChange={(e) => update("importantValues", e.target.value)}
            placeholder="예: 신뢰, 소통, 유머감각"
          />
        </Box>
      )}

      {step === 3 && (
        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label="대화 톤"
            select
            required
            value={data.tone}
            onChange={(e) => update("tone", e.target.value)}
          >
            {Object.entries(TONE_LABELS).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="선호 대화 주제 (쉼표로 구분)"
            required
            value={data.topics}
            onChange={(e) => update("topics", e.target.value)}
            placeholder="예: 여행, 영화, 음식, 기술"
          />
        </Box>
      )}

      {step === 4 && (
        <Box>
          <Typography variant="h6" mb={2}>
            프로필 요약
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            <Typography>
              <strong>이름:</strong> {data.name}
            </Typography>
            <Typography>
              <strong>나이:</strong> {data.age}세
            </Typography>
            <Typography>
              <strong>성별:</strong> {GENDER_LABELS[data.gender]}
            </Typography>
            <Typography>
              <strong>지역:</strong> {data.location}
            </Typography>
            {data.occupation && (
              <Typography>
                <strong>직업:</strong> {data.occupation}
              </Typography>
            )}
            <Typography>
              <strong>관계 목표:</strong>{" "}
              {RELATIONSHIP_GOAL_LABELS[data.relationshipGoal]}
            </Typography>
            <Typography>
              <strong>대화 톤:</strong> {TONE_LABELS[data.tone]}
            </Typography>
            {data.bio && (
              <Typography>
                <strong>소개:</strong> {data.bio}
              </Typography>
            )}
          </Box>
        </Box>
      )}

      <Box display="flex" justifyContent="space-between" mt={4}>
        <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          이전
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            variant="contained"
            disabled={!canNext()}
            onClick={() => setStep((s) => s + 1)}
          >
            다음
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "처리 중..." : submitLabel}
          </Button>
        )}
      </Box>
    </Box>
  );
}
