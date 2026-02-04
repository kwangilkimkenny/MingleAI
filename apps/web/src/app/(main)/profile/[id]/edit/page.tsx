"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import ProfileForm from "@/components/profile/ProfileForm";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { getProfile, updateProfile } from "@/lib/api/profiles";
import { useApi } from "@/hooks/useApi";

export default function EditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: profile, loading, error } = useApi(() => getProfile(id), [id]);

  if (loading) return <LoadingSpinner message="프로필 로딩 중..." />;
  if (error)
    return (
      <Typography color="error" p={4}>
        {error}
      </Typography>
    );
  if (!profile) return null;

  const initialData = {
    name: profile.name,
    age: profile.age,
    gender: profile.gender,
    location: profile.location,
    occupation: profile.occupation || "",
    bio: profile.bio || "",
    ageRange: [
      profile.preferences.ageRange.min,
      profile.preferences.ageRange.max,
    ] as [number, number],
    genderPreference: profile.preferences.genderPreference,
    locationRadius: profile.preferences.locationRadius,
    dealbreakers: profile.preferences.dealbreakers?.join(", ") || "",
    relationshipGoal: profile.values.relationshipGoal,
    lifestyle: profile.values.lifestyle.join(", "),
    importantValues: profile.values.importantValues.join(", "),
    tone: profile.communicationStyle.tone,
    topics: profile.communicationStyle.topics.join(", "),
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    await updateProfile(id, data as Parameters<typeof updateProfile>[1]);
    router.push(`/profile/${id}`);
  };

  return (
    <Box maxWidth={700} mx="auto">
      <Typography variant="h4" fontWeight={700} mb={3}>
        프로필 수정
      </Typography>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <ProfileForm
            initialData={initialData}
            onSubmit={handleSubmit}
            submitLabel="프로필 수정"
          />
        </CardContent>
      </Card>
    </Box>
  );
}
