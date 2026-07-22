"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "user" | "admin" | "super_admin";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  profileId: string | null;
  role: UserRole | null;
  setToken: (token: string | null) => void;
  setProfileId: (profileId: string | null) => void;
  setRole: (role: UserRole | null) => void;
  setAuth: (data: { token: string; refreshToken?: string; profileId?: string; role?: UserRole }) => void;
  logout: () => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      profileId: null,
      role: null,
      setToken: (token) => set({ token }),
      setProfileId: (profileId) => set({ profileId }),
      setRole: (role) => set({ role }),
      setAuth: ({ token, refreshToken, profileId, role }) =>
        set({
          token,
          refreshToken: refreshToken ?? get().refreshToken,
          profileId: profileId ?? get().profileId,
          role: role ?? get().role,
        }),
      logout: () => set({ token: null, refreshToken: null, profileId: null, role: null }),
      isAdmin: () => {
        const role = get().role;
        return role === "admin" || role === "super_admin";
      },
    }),
    { name: "mingle-auth" },
  ),
);
