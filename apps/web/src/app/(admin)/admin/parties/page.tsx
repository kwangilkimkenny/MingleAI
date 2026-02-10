"use client";

import { useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Pagination from "@mui/material/Pagination";
import Skeleton from "@mui/material/Skeleton";
import { getAdminParties, type AdminParty } from "@/lib/api/admin";
import AdminPartyTable from "@/components/admin/parties/AdminPartyTable";

export default function AdminPartiesPage() {
  const [parties, setParties] = useState<AdminParty[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const limit = 20;

  const loadParties = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminParties({
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setParties(res.parties);
      setTotal(res.total);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, status, dateFrom, dateTo]);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  const totalPages = Math.ceil(total / limit);

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        파티 관리
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        총 {total}개의 파티
      </Typography>

      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
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
            <MenuItem value="scheduled">예정</MenuItem>
            <MenuItem value="in_progress">진행중</MenuItem>
            <MenuItem value="completed">완료</MenuItem>
            <MenuItem value="cancelled">취소</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          type="date"
          label="시작일"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          type="date"
          label="종료일"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {loading ? (
        <Box>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={60} sx={{ mb: 1 }} />
          ))}
        </Box>
      ) : parties.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography color="text.secondary">
            조건에 맞는 파티가 없습니다
          </Typography>
        </Box>
      ) : (
        <>
          <AdminPartyTable parties={parties} onRefresh={loadParties} />

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
