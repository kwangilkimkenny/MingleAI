"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import Grid from "@mui/material/Grid2";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Pagination from "@mui/material/Pagination";
import PartyCard from "@/components/party/PartyCard";
import CreatePartyDialog from "@/components/party/CreatePartyDialog";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import { listParties, getParty, type PartyWithCount } from "@/lib/api/parties";

const PAGE_SIZE = 12;

export default function PartiesPage() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<PartyWithCount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // ID 검색
  const [searchId, setSearchId] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  const statusFilter = tab === 0 ? "scheduled" : tab === 1 ? "completed" : undefined;

  const fetchParties = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listParties({
        status: statusFilter,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setParties(res.parties);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setSearchError("");
    setSearching(true);
    try {
      const party = await getParty(searchId.trim());
      router.push(`/parties/${party.id}`);
    } catch {
      setSearchError("파티를 찾을 수 없습니다.");
    } finally {
      setSearching(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
        flexWrap="wrap"
        gap={2}
      >
        <Typography variant="h4" fontWeight={700}>
          파티 둘러보기
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchParties}
            disabled={loading}
          >
            새로고침
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            파티 만들기
          </Button>
        </Box>
      </Box>

      {/* ID 검색 */}
      <Box display="flex" gap={2} mb={3}>
        <TextField
          size="small"
          placeholder="파티 ID로 검색"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          sx={{ flexGrow: 1, maxWidth: 400 }}
        />
        <Button variant="outlined" onClick={handleSearch} disabled={searching}>
          {searching ? "검색 중..." : "검색"}
        </Button>
      </Box>

      {searchError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSearchError("")}>
          {searchError}
        </Alert>
      )}

      {/* 탭 필터 */}
      <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(1); }} sx={{ mb: 3 }}>
        <Tab label="참가 가능" />
        <Tab label="완료됨" />
        <Tab label="전체" />
      </Tabs>

      {loading ? (
        <LoadingSpinner message="파티 목록을 불러오는 중..." />
      ) : parties.length === 0 ? (
        <EmptyState
          title={tab === 0 ? "참가 가능한 파티가 없습니다" : "파티가 없습니다"}
          description={tab === 0 ? "새 파티를 만들어 친구들을 초대하세요!" : "아직 진행된 파티가 없습니다."}
          actionLabel="파티 만들기"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <>
          <Box mb={2}>
            <Chip label={`${total}개의 파티`} size="small" />
          </Box>
          <Grid container spacing={2}>
            {parties.map((party) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={party.id}>
                <PartyCard
                  party={party}
                  onClick={() => router.push(`/parties/${party.id}`)}
                />
              </Grid>
            ))}
          </Grid>
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}

      <CreatePartyDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(id) => {
          router.push(`/parties/${id}`);
        }}
      />
    </Box>
  );
}
