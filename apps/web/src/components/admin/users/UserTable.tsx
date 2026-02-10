"use client";

import { useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useRouter } from "next/navigation";
import { type AdminUser, updateUserStatus, deleteUser } from "@/lib/api/admin";

interface UserTableProps {
  users: AdminUser[];
  onRefresh: () => void;
}

export default function UserTable({ users, onRefresh }: UserTableProps) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    user: AdminUser,
  ) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedUser(null);
  };

  const handleViewDetail = () => {
    if (selectedUser) {
      router.push(`/admin/users/${selectedUser.id}`);
    }
    handleMenuClose();
  };

  const handleToggleStatus = async () => {
    if (!selectedUser?.profile) return;

    const newStatus =
      selectedUser.profile.status === "active" ? "suspended" : "active";
    try {
      await updateUserStatus(selectedUser.id, newStatus);
      onRefresh();
    } catch (error) {
      console.error(error);
      alert("상태 변경에 실패했습니다");
    }
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    if (!confirm("정말 이 사용자를 삭제하시겠습니까?")) return;

    try {
      await deleteUser(selectedUser.id);
      onRefresh();
    } catch (error) {
      console.error(error);
      alert("삭제에 실패했습니다");
    }
    handleMenuClose();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR");
  };

  const getStatusColor = (status: string): "success" | "error" | "warning" | "default" => {
    switch (status) {
      case "active":
        return "success";
      case "suspended":
        return "error";
      case "deleted":
        return "default";
      default:
        return "warning";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "활성";
      case "suspended":
        return "정지";
      case "deleted":
        return "삭제됨";
      default:
        return status;
    }
  };

  return (
    <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>이메일</TableCell>
              <TableCell>이름</TableCell>
              <TableCell>나이/성별</TableCell>
              <TableCell>상태</TableCell>
              <TableCell align="right">파티</TableCell>
              <TableCell align="right">예약</TableCell>
              <TableCell>가입일</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => router.push(`/admin/users/${user.id}`)}
              >
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.profile?.name ?? "-"}</TableCell>
                <TableCell>
                  {user.profile
                    ? `${user.profile.age}세 / ${user.profile.gender}`
                    : "-"}
                </TableCell>
                <TableCell>
                  {user.profile ? (
                    <Chip
                      label={getStatusLabel(user.profile.status)}
                      size="small"
                      color={getStatusColor(user.profile.status)}
                    />
                  ) : (
                    <Chip label="프로필 없음" size="small" variant="outlined" />
                  )}
                </TableCell>
                <TableCell align="right">
                  {user.profile?.partyCount ?? 0}
                </TableCell>
                <TableCell align="right">
                  {user.profile?.reservationCount ?? 0}
                </TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, user)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDetail}>상세보기</MenuItem>
        {selectedUser?.profile && (
          <MenuItem onClick={handleToggleStatus}>
            {selectedUser.profile.status === "active"
              ? "계정 정지"
              : "계정 활성화"}
          </MenuItem>
        )}
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          삭제
        </MenuItem>
      </Menu>
    </>
  );
}
