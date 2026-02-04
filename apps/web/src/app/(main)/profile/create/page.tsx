"use client";

import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import ProfileForm from "@/components/profile/ProfileForm";
import { createProfile } from "@/lib/api/profiles";
import { useAuthStore } from "@/lib/store/auth";

export default function CreateProfilePage() {
  const router = useRouter();
  const setProfileId = useAuthStore((s) => s.setProfileId);

  const handleSubmit = async (data: Record<string, unknown>) => {
    const profile = await createProfile(data as unknown as Parameters<typeof createProfile>[0]);
    setProfileId(profile.id);
    router.push(`/profile/${profile.id}`);
  };

  return (
    <Box maxWidth={700} mx="auto">
      <Typography variant="h4" fontWeight={700} mb={3}>
        프로필 만들기
      </Typography>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <ProfileForm onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </Box>
  );
}
