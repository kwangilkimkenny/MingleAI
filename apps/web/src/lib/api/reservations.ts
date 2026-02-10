import { apiFetch } from "./client";

export interface Reservation {
  id: string;
  partyId: string;
  profileId: string;
  status: "confirmed" | "cancelled" | "attended";
  createdAt: string;
  updatedAt: string;
  party: {
    id: string;
    name: string;
    scheduledAt: string;
    maxParticipants: number;
    theme?: string;
    location?: string;
    status: string;
    participantCount: number;
  };
}

export interface ReservationsResponse {
  reservations: Reservation[];
  total: number;
  limit: number;
  offset: number;
}

export async function createReservation(
  partyId: string,
  profileId: string,
): Promise<Reservation> {
  return apiFetch("/reservations", {
    method: "POST",
    body: JSON.stringify({ partyId, profileId }),
  });
}

export async function getReservations(
  profileId: string,
  limit?: number,
  offset?: number,
): Promise<ReservationsResponse> {
  const params = new URLSearchParams({ profileId });
  if (limit) params.set("limit", limit.toString());
  if (offset) params.set("offset", offset.toString());
  return apiFetch(`/reservations?${params.toString()}`);
}

export async function getUpcomingReservations(
  profileId: string,
  limit?: number,
): Promise<Reservation[]> {
  const params = new URLSearchParams({ profileId });
  if (limit) params.set("limit", limit.toString());
  return apiFetch(`/reservations/upcoming?${params.toString()}`);
}

export async function getReservation(id: string): Promise<Reservation> {
  return apiFetch(`/reservations/${id}`);
}

export async function cancelReservation(
  id: string,
  profileId: string,
): Promise<Reservation> {
  return apiFetch(`/reservations/${id}?profileId=${profileId}`, {
    method: "DELETE",
  });
}
