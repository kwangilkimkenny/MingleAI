import {
  configureClient,
  createAuthStore,
  setTokenAccessor,
} from "@mingle/client-core";
import { secureStorage } from "./secure-storage";

export const useAuthStore = createAuthStore(secureStorage);

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

configureClient({
  baseUrl,
  onUnauthorized: () => useAuthStore.getState().logout(),
});

setTokenAccessor(() => useAuthStore.getState().token);
