import type { KeyValueStorage } from "@mingle/client-core";

/**
 * Web variant of {@link secureStorage} (Metro picks `.web.ts` for the web bundle).
 *
 * `expo-secure-store` is a no-op on web, so without this the auth token never
 * persists and every reload logs the user out. Back it with `localStorage`
 * (falling back to an in-memory map when storage is unavailable, e.g. private
 * mode). Note: the web build is the RN-web/testing surface, not the primary
 * secure client — a JWT in localStorage is acceptable there; native keeps using
 * the Keychain/Keystore via SecureStore.
 */
const memory = new Map<string, string>();

function ls(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const secureStorage: KeyValueStorage = {
  getItem: async (key) => {
    const store = ls();
    if (!store) return memory.get(key) ?? null;
    try {
      return store.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem: async (key, value) => {
    memory.set(key, value);
    try {
      ls()?.setItem(key, value);
    } catch {
      /* storage unavailable — memory fallback already holds it */
    }
  },
  removeItem: async (key) => {
    memory.delete(key);
    try {
      ls()?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
