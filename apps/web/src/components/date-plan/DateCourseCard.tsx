"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import type { DateCourse } from "@mingle/shared";

export default function DateCourseCard({ course }: { course: DateCourse }) {
  return (
    <Card>
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6" fontWeight={600}>
            {course.label}
          </Typography>
          <Box display="flex" gap={1}>
            <Chip
              label={`${course.totalEstimatedCost.toLocaleString()}원`}
              color="primary"
              size="small"
            />
            <Chip
              label={`${course.totalEstimatedMinutes}분`}
              variant="outlined"
              size="small"
            />
          </Box>
        </Box>

        {/* Custom Timeline */}
        <Box sx={{ pl: 1 }}>
          {course.stops.map((stop, i) => (
            <Box key={i} display="flex" gap={2} position="relative">
              {/* Connector line */}
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                sx={{ minWidth: 32 }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: 2,
                    borderColor: "primary.main",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "background.paper",
                    zIndex: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    color="primary"
                    fontWeight={700}
                  >
                    {stop.order}
                  </Typography>
                </Box>
                {i < course.stops.length - 1 && (
                  <Box
                    sx={{
                      width: 2,
                      flexGrow: 1,
                      bgcolor: "divider",
                      minHeight: 20,
                    }}
                  />
                )}
              </Box>

              {/* Content */}
              <Box pb={3} flexGrow={1}>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography variant="subtitle2" fontWeight={600}>
                    {stop.name}
                  </Typography>
                  <Chip label={stop.type} size="small" variant="outlined" />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {stop.rationale}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {stop.estimatedCost.toLocaleString()}원 ·{" "}
                  {stop.estimatedMinutes}분
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
