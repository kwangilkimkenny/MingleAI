"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getAdminUserDetail, updateUserStatus, deleteUser, type AdminUserDetail } from "@/lib/api/admin";
import UserDetailCard from "@/components/admin/users/UserDetailCard";

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      getAdminUserDetail(userId)
        .then(setUser)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [userId]);

  const handleToggleStatus = async () => {
    if (!user?.profile) return;

    const newStatus =
      user.profile.status === "active" ? "suspended" : "active";
    try {
      await updateUserStatus(user.id, newStatus);
      setUser({
        ...user,
        profile: { ...user.profile, status: newStatus },
      });
    } catch (error) {
      console.error(error);
      alert("상태 변경에 실패했습니다");
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm("정말 이 사용자를 삭제하시겠습니까?")) return;

    try {
      await deleteUser(user.id);
      router.push("/admin/users");
    } catch (error) {
      console.error(error);
      alert("삭제에 실패했습니다");
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton height={40} width={200} sx={{ mb: 2 }} />
        <Skeleton height={200} />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box textAlign="center" py={8}>
        <Typography>사용자를 찾을 수 없습니다</Typography>
        <Button onClick={() => router.push("/admin/users")} sx={{ mt: 2 }}>
          목록으로
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push("/admin/users")}
        >
          목록으로
        </Button>
      </Box>

      <UserDetailCard user={user} />

      <Box display="flex" gap={2} mt={3}>
        {user.profile && (
          <Button
            variant="outlined"
            color={user.profile.status === "active" ? "error" : "success"}
            onClick={handleToggleStatus}
          >
            {user.profile.status === "active" ? "계정 정지" : "계정 활성화"}
          </Button>
        )}
        <Button variant="outlined" color="error" onClick={handleDelete}>
          사용자 삭제
        </Button>
      </Box>

    </Box>
  );
}
