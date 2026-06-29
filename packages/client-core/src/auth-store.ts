import { create, type UseBoundStore, type StoreApi } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { KeyValueStorage } from "./storage.js";

export type UserRole = "user" | "admin" | "super_admin";

export interface AuthState {
  token: string | null;
  profileId: string | null;
  role: UserRole | null;
  setAuth: (data: { token: string; profileId?: string; role?: UserRole }) => void;
  logout: () => void;
  isAdmin: () => boolean;
}

export function createAuthStore(
  storage: KeyValueStorage,
): UseBoundStore<StoreApi<AuthState>> {
  return create<AuthState>()(
    persist(
      (set, get) => ({
        token: null,
        profileId: null,
        role: null,
        setAuth: ({ token, profileId, role }) =>
          set({
            token,
            profileId: profileId ?? get().profileId,
            role: role ?? get().role,
          }),
        logout: () => set({ token: null, profileId: null, role: null }),
        isAdmin: () => {
          const role = get().role;
          return role === "admin" || role === "super_admin";
        },
      }),
      { name: "mingle-auth", storage: createJSONStorage(() => storage) },
    ),
  );
}
