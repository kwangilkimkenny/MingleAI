import {
  configureClient,
  createAuthStore,
  refreshSession,
  setTokenAccessor,
} from "@mingle/client-core";
import { secureStorage } from "./secure-storage";

export const useAuthStore = createAuthStore(secureStorage);

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

configureClient({
  baseUrl,
  onUnauthorized: () => useAuthStore.getState().logout(),
  refreshAccessToken: async () => {
    const current = useAuthStore.getState().refreshToken;
    if (!current) return null;
    const session = await refreshSession(current);
    useAuthStore.getState().setAuth({
      token: session.accessToken,
      refreshToken: session.refreshToken,
      role: session.role,
    });
    return session.accessToken;
  },
});

setTokenAccessor(() => useAuthStore.getState().token);
