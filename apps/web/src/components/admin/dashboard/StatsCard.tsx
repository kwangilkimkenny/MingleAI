"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import type { SvgIconComponent } from "@mui/icons-material";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: SvgIconComponent;
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info";
  subtitle?: string;
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  color = "primary",
  subtitle,
}: StatsCardProps) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={700}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              // 다크 배경에서 `${color}.light` 채움은 아이콘과 대비가 안 난다 — 중립 틴트 위에 색 아이콘.
              bgcolor: "action.hover",
              color: `${color}.main`,
            }}
          >
            <Icon fontSize="large" />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
