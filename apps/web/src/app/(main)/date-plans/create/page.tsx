"use client";

import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import DatePlanForm from "@/components/date-plan/DatePlanForm";
import { createDatePlan } from "@/lib/api/date-plans";
import { useAuthStore } from "@/lib/store/auth";

export default function CreateDatePlanPage() {
  const router = useRouter();
  const profileId = useAuthStore((s) => s.profileId);

  const handleSubmit = async (
    data: Parameters<typeof createDatePlan>[0],
  ) => {
    const plan = await createDatePlan(data);
    router.push(`/date-plans/${plan.id}`);
  };

  return (
    <Box maxWidth={700} mx="auto">
      <Typography variant="h4" fontWeight={700} mb={3}>
        데이트 코스 생성
      </Typography>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <DatePlanForm onSubmit={handleSubmit} defaultProfileId={profileId} />
        </CardContent>
      </Card>
    </Box>
  );
}
