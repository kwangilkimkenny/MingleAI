"use client";

import { use } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid2";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import DateCourseCard from "@/components/date-plan/DateCourseCard";
import { getDatePlan } from "@/lib/api/date-plans";
import { useApi } from "@/hooks/useApi";
import { DATE_PLAN_STATUS_LABELS } from "@/lib/constants";

export default function DatePlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: plan, loading, error } = useApi(() => getDatePlan(id), [id]);

  if (loading) return <LoadingSpinner message="데이트 코스 로딩 중..." />;
  if (error)
    return (
      <Typography color="error" p={4}>
        {error}
      </Typography>
    );
  if (!plan) return null;

  return (
    <Box maxWidth={900} mx="auto">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" fontWeight={700}>
          데이트 코스
        </Typography>
        <Chip
          label={DATE_PLAN_STATUS_LABELS[plan.status]}
          color={plan.status === "confirmed" ? "success" : "default"}
        />
      </Box>

      {/* Constraints summary */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} mb={1}>
            조건 요약
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip
              label={`예산: ${plan.constraints.budget.total.toLocaleString()}${plan.constraints.budget.currency}`}
              variant="outlined"
              size="small"
            />
            <Chip
              label={`장소: ${plan.constraints.location.city}${plan.constraints.location.district ? ` ${plan.constraints.location.district}` : ""}`}
              variant="outlined"
              size="small"
            />
            <Chip
              label={`날짜: ${new Date(plan.constraints.dateTime.preferredDate).toLocaleDateString("ko-KR")}`}
              variant="outlined"
              size="small"
            />
            <Chip
              label={`${plan.constraints.dateTime.durationHours}시간`}
              variant="outlined"
              size="small"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Courses */}
      <Typography variant="h5" fontWeight={600} mb={2}>
        추천 코스 ({plan.courses.length}개)
      </Typography>
      <Grid container spacing={3}>
        {plan.courses.map((course) => (
          <Grid size={{ xs: 12 }} key={course.courseId}>
            <DateCourseCard course={course} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
