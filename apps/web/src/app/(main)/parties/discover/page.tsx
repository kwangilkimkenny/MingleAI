"use client";

import { useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid2";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Pagination from "@mui/material/Pagination";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PeopleIcon from "@mui/icons-material/People";
import EventIcon from "@mui/icons-material/Event";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import PartyFilterBar, {
  type PartyFilters,
} from "@/components/party/PartyFilterBar";
import ReservationButton from "@/components/party/ReservationButton";
import { apiFetch } from "@/lib/api/client";

interface Party {
  id: string;
  name: string;
  scheduledAt: string;
  maxParticipants: number;
  theme?: string;
  location?: string;
  ageMin?: number;
  ageMax?: number;
  status: string;
  participantCount: number;
}

interface PartiesResponse {
  parties: Party[];
  total: number;
  limit: number;
  offset: number;
}

export default function DiscoverPartiesPage() {
  const router = useRouter();
  const profileId = useAuthStore((s) => s.profileId);
  const [parties, setParties] = useState<Party[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PartyFilters>({});

  const limit = 12;

  const loadParties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", "scheduled");
      params.set("limit", limit.toString());
      params.set("offset", ((page - 1) * limit).toString());

      if (filters.theme) params.set("theme", filters.theme);
      if (filters.location) params.set("location", filters.location);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);

      const res = await apiFetch<PartiesResponse>(`/parties?${params.toString()}`);
      setParties(res.parties);
      setTotal(res.total);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        파티 탐색
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        참가 가능한 파티를 찾아보세요
      </Typography>

      <PartyFilterBar
        filters={filters}
        onChange={(newFilters) => {
          setFilters(newFilters);
          setPage(1);
        }}
      />

      {loading ? (
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardContent>
                  <Skeleton height={30} width="60%" />
                  <Skeleton height={20} width="40%" sx={{ mt: 1 }} />
                  <Skeleton height={60} sx={{ mt: 2 }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : parties.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary">
            조건에 맞는 파티가 없습니다
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            필터를 변경해 보세요
          </Typography>
        </Box>
      ) : (
        <>
          <Grid container spacing={3}>
            {parties.map((party) => (
              <Grid key={party.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                    "&:hover": { boxShadow: 4 },
                  }}
                  onClick={() => router.push(`/parties/${party.id}`)}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Typography variant="h6" fontWeight={600}>
                        {party.name}
                      </Typography>
                      {party.theme && (
                        <Chip label={party.theme} size="small" color="primary" />
                      )}
                    </Box>

                    <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                      <EventIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(party.scheduledAt)}
                      </Typography>
                    </Box>

                    {party.location && (
                      <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                        <LocationOnIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {party.location}
                        </Typography>
                      </Box>
                    )}

                    <Box display="flex" alignItems="center" gap={0.5}>
                      <PeopleIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {party.participantCount} / {party.maxParticipants}명
                      </Typography>
                    </Box>

                    {(party.ageMin || party.ageMax) && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        mt={1}
                      >
                        연령: {party.ageMin || "제한없음"} ~ {party.ageMax || "제한없음"}세
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <ReservationButton
                      partyId={party.id}
                      isFull={party.participantCount >= party.maxParticipants}
                      onSuccess={loadParties}
                    />
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

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
