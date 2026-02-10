"use client";

import { useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Skeleton from "@mui/material/Skeleton";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import { getAdminUsers, type AdminUser } from "@/lib/api/admin";
import UserTable from "@/components/admin/users/UserTable";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const limit = 20;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminUsers({
        search: search || undefined,
        status: status || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const totalPages = Math.ceil(total / limit);

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        사용자 관리
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        총 {total}명의 사용자
      </Typography>

      <Box display="flex" gap={2} mb={3}>
        <TextField
          size="small"
          placeholder="이름 또는 이메일 검색"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ width: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>상태</InputLabel>
          <Select
            value={status}
            label="상태"
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">전체</MenuItem>
            <MenuItem value="active">활성</MenuItem>
            <MenuItem value="suspended">정지</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={60} sx={{ mb: 1 }} />
          ))}
        </Box>
      ) : users.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography color="text.secondary">
            조건에 맞는 사용자가 없습니다
          </Typography>
        </Box>
      ) : (
        <>
          <UserTable users={users} onRefresh={loadUsers} />

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
