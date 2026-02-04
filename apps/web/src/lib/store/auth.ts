"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  profileId: string | null;
  setToken: (token: string | null) => void;
  setProfileId: (profileId: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      profileId: null,
      setToken: (token) => set({ token }),
      setProfileId: (profileId) => set({ profileId }),
      logout: () => set({ token: null, profileId: null }),
    }),
    { name: "mingle-auth" },
  ),
);
