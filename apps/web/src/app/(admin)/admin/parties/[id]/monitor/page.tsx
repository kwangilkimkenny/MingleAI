"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getAdminPartyDetail } from "@/lib/api/admin";
import LivePartyMonitor from "@/components/admin/parties/LivePartyMonitor";

export default function PartyMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const partyId = params.id as string;

  const [partyName, setPartyName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (partyId) {
      getAdminPartyDetail(partyId)
        .then((party) => setPartyName(party.name))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [partyId]);

  if (loading) {
    return (
      <Box>
        <Skeleton height={40} width={200} sx={{ mb: 2 }} />
        <Skeleton height={400} />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/admin/parties/${partyId}`)}
        >
          파티 상세로
        </Button>
      </Box>

      <LivePartyMonitor partyId={partyId} partyName={partyName} />
    </Box>
  );
}
