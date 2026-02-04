"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import EditIcon from "@mui/icons-material/Edit";
import ProfileCard from "@/components/profile/ProfileCard";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { getProfile } from "@/lib/api/profiles";
import { useApi } from "@/hooks/useApi";
import { useAuthStore } from "@/lib/store/auth";

export default function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const profileId = useAuthStore((s) => s.profileId);
  const { data: profile, loading, error } = useApi(() => getProfile(id), [id]);

  if (loading) return <LoadingSpinner message="프로필 로딩 중..." />;
  if (error)
    return (
      <Typography color="error" p={4}>
        {error}
      </Typography>
    );
  if (!profile) return null;

  return (
    <Box maxWidth={700} mx="auto">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" fontWeight={700}>
          프로필
        </Typography>
        {profileId === id && (
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => router.push(`/profile/${id}/edit`)}
          >
            수정
          </Button>
        )}
      </Box>
      <ProfileCard profile={profile} />
    </Box>
  );
}
