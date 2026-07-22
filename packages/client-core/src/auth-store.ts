import { create, type UseBoundStore, type StoreApi } from "zustand";
import { persist, createJSONStorage, type PersistOptions } from "zustand/middleware";
import type { KeyValueStorage } from "./storage.js";

export type UserRole = "user" | "admin" | "super_admin";

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  profileId: string | null;
  role: UserRole | null;
  setAuth: (data: { token: string; refreshToken?: string; profileId?: string; role?: UserRole }) => void;
  logout: () => void;
  isAdmin: () => boolean;
}

type AuthStoreApi = StoreApi<AuthState> & {
  persist: {
    setOptions: (options: Partial<PersistOptions<AuthState, unknown>>) => void;
    clearStorage: () => void;
    rehydrate: () => Promise<void> | void;
    hasHydrated: () => boolean;
    onHydrate: (fn: (state: AuthState) => void) => () => void;
    onFinishHydration: (fn: (state: AuthState) => void) => () => void;
    getOptions: () => Partial<PersistOptions<AuthState, unknown>>;
  };
};

export function createAuthStore(
  storage: KeyValueStorage,
): UseBoundStore<AuthStoreApi> {
  return create<AuthState>()(
    persist(
      (set, get) => ({
        token: null,
        refreshToken: null,
        profileId: null,
        role: null,
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
      {
        name: "mingle-auth",
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({
          token: state.token,
          refreshToken: state.refreshToken,
          profileId: state.profileId,
          role: state.role,
        }),
        onRehydrateStorage: () => (_state, error) => {
          if (error) {
            console.error("[mingle-auth] failed to rehydrate auth state:", error);
          }
        },
      },
    ),
  );
}
