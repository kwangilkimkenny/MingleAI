"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import Grid from "@mui/material/Grid2";
import Alert from "@mui/material/Alert";
import PartyCard from "@/components/party/PartyCard";
import CreatePartyDialog from "@/components/party/CreatePartyDialog";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import { getParty } from "@/lib/api/parties";

export default function PartiesPage() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [partyId, setPartyId] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [parties, setParties] = useState<
    Array<{ id: string; name: string; scheduledAt: string; maxParticipants: number; theme?: string; roundCount: number; roundDurationMinutes: number; status: string; createdAt: string; updatedAt: string }>
  >([]);

  const handleSearch = useCallback(async () => {
    if (!partyId.trim()) return;
    setSearchError("");
    setSearching(true);
    try {
      const party = await getParty(partyId.trim());
      setParties((prev) => {
        if (prev.find((p) => p.id === party.id)) return prev;
        return [...prev, party];
      });
      setPartyId("");
    } catch {
      setSearchError("파티를 찾을 수 없습니다.");
    } finally {
      setSearching(false);
    }
  }, [partyId]);

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" fontWeight={700}>
          파티
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          파티 만들기
        </Button>
      </Box>

      <Box display="flex" gap={2} mb={3}>
        <TextField
          size="small"
          placeholder="파티 ID로 검색"
          value={partyId}
          onChange={(e) => setPartyId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          sx={{ flexGrow: 1 }}
        />
        <Button variant="outlined" onClick={handleSearch} disabled={searching}>
          {searching ? "검색 중..." : "검색"}
        </Button>
      </Box>

      {searchError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {searchError}
        </Alert>
      )}

      {parties.length === 0 ? (
        <EmptyState
          title="파티가 없습니다"
          description="새 파티를 만들거나, 파티 ID로 검색하세요."
          actionLabel="파티 만들기"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <Grid container spacing={2}>
          {parties.map((party) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={party.id}>
              <PartyCard
                party={party as Parameters<typeof PartyCard>[0]["party"]}
                onClick={() => router.push(`/parties/${party.id}`)}
              />
            </Grid>
          ))}
        </Grid>
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
