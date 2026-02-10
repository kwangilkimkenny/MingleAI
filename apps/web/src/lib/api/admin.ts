import { apiFetch } from "./client";

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalParties: number;
  scheduledParties: number;
  completedParties: number;
  totalReservations: number;
  pendingReports: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  profile: {
    id: string;
    name: string;
    age: number;
    gender: string;
    location: string;
    status: string;
    riskScore: number;
    partyCount: number;
    reservationCount: number;
  } | null;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminParty {
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
  reservationCount: number;
}

export interface AdminPartiesResponse {
  parties: AdminParty[];
  total: number;
  limit: number;
  offset: number;
}

export interface SafetyReport {
  id: string;
  reason: string;
  details?: string;
  status: string;
  createdAt: string;
  reporter: { id: string; name: string };
  reported: { id: string; name: string };
}

export interface SafetyReportsResponse {
  reports: SafetyReport[];
  total: number;
  limit: number;
  offset: number;
}

// 통계
export async function getAdminStats(): Promise<AdminStats> {
  return apiFetch("/admin/stats");
}

// 사용자 관리
export async function getAdminUsers(options?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminUsersResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.search) params.set("search", options.search);
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());
  const query = params.toString();
  return apiFetch(`/admin/users${query ? `?${query}` : ""}`);
}

export interface AdminUserDetail {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  profile?: {
    id: string;
    name: string;
    age: number;
    gender: string;
    location: string;
    occupation?: string;
    bio?: string;
    status: string;
    riskScore: number;
    createdAt: string;
    partyParticipants?: { party: { id: string; name: string; scheduledAt: string }; joinedAt: string }[];
    reservations?: { id: string; party: { name: string }; status: string; createdAt: string }[];
    reportsFiled?: { id: string; reason: string; createdAt: string }[];
    reportsReceived?: { id: string; reason: string; createdAt: string }[];
  } | null;
  notifications?: { id: string; type: string; title: string; read: boolean; createdAt: string }[];
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  return apiFetch(`/admin/users/${userId}`);
}

export async function updateUserStatus(
  userId: string,
  status: "active" | "suspended",
) {
  return apiFetch(`/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteUser(userId: string) {
  return apiFetch(`/admin/users/${userId}`, { method: "DELETE" });
}

// 파티 관리
export async function getAdminParties(options?: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminPartiesResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.dateFrom) params.set("dateFrom", options.dateFrom);
  if (options?.dateTo) params.set("dateTo", options.dateTo);
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());
  const query = params.toString();
  return apiFetch(`/admin/parties${query ? `?${query}` : ""}`);
}

export interface AdminPartyDetail {
  id: string;
  name: string;
  scheduledAt: string;
  maxParticipants: number;
  theme?: string;
  location?: string;
  ageMin?: number;
  ageMax?: number;
  status: string;
  roundCount: number;
  roundDurationMinutes: number;
  participants: {
    party: { id: string };
    profile: { id: string; name: string; age: number; gender: string };
    joinedAt: string;
  }[];
  reservations: {
    id: string;
    status: string;
    profile: { id: string; name: string; age: number; gender: string };
    createdAt: string;
  }[];
  reports: {
    id: string;
    profile: { id: string; name: string };
  }[];
}

export async function getAdminPartyDetail(partyId: string): Promise<AdminPartyDetail> {
  return apiFetch(`/admin/parties/${partyId}`);
}

export async function updateAdminParty(
  partyId: string,
  data: Partial<{
    name: string;
    scheduledAt: string;
    maxParticipants: number;
    theme: string;
    location: string;
    ageMin: number;
    ageMax: number;
    status: string;
  }>,
) {
  return apiFetch(`/admin/parties/${partyId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// 신고 관리
export async function getSafetyReports(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<SafetyReportsResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());
  const query = params.toString();
  return apiFetch(`/admin/safety-reports${query ? `?${query}` : ""}`);
}

export async function resolveSafetyReport(
  reportId: string,
  resolution: {
    status: "resolved" | "dismissed";
    action?: "warn" | "suspend" | "ban" | "none";
    notes?: string;
  },
) {
  return apiFetch(`/admin/safety-reports/${reportId}/resolve`, {
    method: "POST",
    body: JSON.stringify(resolution),
  });
}
