"use client";

import { use } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useRouter } from "next/navigation";
import PartyResultsView from "@/components/party/PartyResultsView";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import { getPartyResults } from "@/lib/api/parties";
import { useApi } from "@/hooks/useApi";

export default function PartyResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const {
    data: results,
    loading,
    error,
  } = useApi(() => getPartyResults(id), [id]);

  if (loading) return <LoadingSpinner message="결과 로딩 중..." />;
  if (error)
    return (
      <Typography color="error" p={4}>
        {error}
      </Typography>
    );

  return (
    <Box maxWidth={800} mx="auto">
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/parties/${id}`)}
        >
          돌아가기
        </Button>
        <Typography variant="h4" fontWeight={700}>
          파티 결과
        </Typography>
      </Box>

      {results ? (
        <PartyResultsView results={results} />
      ) : (
        <EmptyState title="결과가 없습니다" description="파티를 먼저 실행해주세요." />
      )}
    </Box>
  );
}
