"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import type { Profile } from "@mingle/shared";
import {
  GENDER_LABELS,
  RELATIONSHIP_GOAL_LABELS,
  TONE_LABELS,
} from "@/lib/constants";

export default function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <Card>
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h5" fontWeight={700}>
            {profile.name}
          </Typography>
          <Chip
            label={profile.status === "active" ? "활성" : profile.status}
            color={profile.status === "active" ? "success" : "default"}
            size="small"
          />
        </Box>

        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          <Chip label={`${profile.age}세`} variant="outlined" size="small" />
          <Chip
            label={GENDER_LABELS[profile.gender]}
            variant="outlined"
            size="small"
          />
          <Chip label={profile.location} variant="outlined" size="small" />
          {profile.occupation && (
            <Chip
              label={profile.occupation}
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        {profile.bio && (
          <Typography variant="body2" color="text.secondary" mb={2}>
            {profile.bio}
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" color="primary" gutterBottom>
          가치관
        </Typography>
        <Typography variant="body2" mb={1}>
          <strong>관계 목표:</strong>{" "}
          {RELATIONSHIP_GOAL_LABELS[profile.values.relationshipGoal]}
        </Typography>
        <Box display="flex" gap={0.5} flexWrap="wrap" mb={1}>
          {profile.values.lifestyle.map((l) => (
            <Chip key={l} label={l} size="small" color="secondary" />
          ))}
        </Box>
        <Box display="flex" gap={0.5} flexWrap="wrap" mb={2}>
          {profile.values.importantValues.map((v) => (
            <Chip key={v} label={v} size="small" />
          ))}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" color="primary" gutterBottom>
          소통 스타일
        </Typography>
        <Typography variant="body2" mb={1}>
          <strong>톤:</strong> {TONE_LABELS[profile.communicationStyle.tone]}
        </Typography>
        <Box display="flex" gap={0.5} flexWrap="wrap">
          {profile.communicationStyle.topics.map((t) => (
            <Chip key={t} label={t} size="small" variant="outlined" />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
