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
import { type AdminParty, updateAdminParty } from "@/lib/api/admin";

interface AdminPartyTableProps {
  parties: AdminParty[];
  onRefresh: () => void;
}

export default function AdminPartyTable({
  parties,
  onRefresh,
}: AdminPartyTableProps) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedParty, setSelectedParty] = useState<AdminParty | null>(null);

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    party: AdminParty,
  ) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedParty(party);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedParty(null);
  };

  const handleViewDetail = () => {
    if (selectedParty) {
      router.push(`/admin/parties/${selectedParty.id}`);
    }
    handleMenuClose();
  };

  const handleMonitor = () => {
    if (selectedParty) {
      router.push(`/admin/parties/${selectedParty.id}/monitor`);
    }
    handleMenuClose();
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedParty) return;

    try {
      await updateAdminParty(selectedParty.id, { status });
      onRefresh();
    } catch (error) {
      console.error(error);
      alert("상태 변경에 실패했습니다");
    }
    handleMenuClose();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string): "primary" | "warning" | "success" | "error" | "default" => {
    switch (status) {
      case "scheduled":
        return "primary";
      case "in_progress":
        return "warning";
      case "completed":
        return "success";
      case "cancelled":
        return "error";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "scheduled":
        return "예정";
      case "in_progress":
        return "진행중";
      case "completed":
        return "완료";
      case "cancelled":
        return "취소";
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
              <TableCell>파티명</TableCell>
              <TableCell>테마</TableCell>
              <TableCell>지역</TableCell>
              <TableCell>일시</TableCell>
              <TableCell>상태</TableCell>
              <TableCell align="right">참가자</TableCell>
              <TableCell align="right">예약</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parties.map((party) => (
              <TableRow
                key={party.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => router.push(`/admin/parties/${party.id}`)}
              >
                <TableCell>{party.name}</TableCell>
                <TableCell>
                  {party.theme ? (
                    <Chip label={party.theme} size="small" variant="outlined" />
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{party.location ?? "-"}</TableCell>
                <TableCell>{formatDate(party.scheduledAt)}</TableCell>
                <TableCell>
                  <Chip
                    label={getStatusLabel(party.status)}
                    size="small"
                    color={getStatusColor(party.status)}
                  />
                </TableCell>
                <TableCell align="right">{party.participantCount}</TableCell>
                <TableCell align="right">
                  {party.reservationCount}/{party.maxParticipants}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, party)}
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
        {selectedParty?.status === "in_progress" && (
          <MenuItem onClick={handleMonitor}>실시간 모니터링</MenuItem>
        )}
        {selectedParty?.status === "scheduled" && (
          <MenuItem onClick={() => handleStatusChange("cancelled")}>
            파티 취소
          </MenuItem>
        )}
        {selectedParty?.status === "in_progress" && (
          <MenuItem onClick={() => handleStatusChange("completed")}>
            파티 종료
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
