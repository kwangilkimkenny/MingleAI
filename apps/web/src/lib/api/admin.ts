import { apiFetch } from "./client";

/** `GET /admin/stats`가 실제로 주는 값. 여기 없는 필드를 화면에 그리면 undefined가 찍힌다. */
export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
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
  } | null;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReportPeer {
  profileId: string;
  name: string;
  age: number;
  gender: string;
}

export interface SafetyReport {
  id: string;
  reason: string;
  details?: string | null;
  status: string;
  createdAt: string;
  reporter: ReportPeer;
  reported: ReportPeer;
}

export interface SafetyReportsResponse {
  reports: SafetyReport[];
  total: number;
  limit: number;
  offset: number;
}

export interface SafetyReportDetail {
  id: string;
  reason: string;
  details?: string | null;
  status: string;
  createdAt: string;
  reporter: ReportPeer;
  reported: ReportPeer & { status: string };
  reportsAgainstReported: number;
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

export async function getSafetyReportDetail(
  reportId: string,
): Promise<SafetyReportDetail> {
  return apiFetch(`/admin/safety-reports/${reportId}`);
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

/** 정지·차단된 프로필을 다시 활성화(계정 복구). profileId = report.reported.profileId. */
export async function reinstateProfile(profileId: string) {
  return apiFetch(`/admin/profiles/${profileId}/reinstate`, {
    method: "PATCH",
  });
}
