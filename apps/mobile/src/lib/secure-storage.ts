import * as SecureStore from "expo-secure-store";
import type { KeyValueStorage } from "@mingle/client-core";

export const secureStorage: KeyValueStorage = {
  getItem: async (key) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn(`[secure-storage] getItem failed for "${key}":`, e);
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn(`[secure-storage] setItem failed for "${key}":`, e);
    }
  },
  removeItem: async (key) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn(`[secure-storage] removeItem failed for "${key}":`, e);
    }
  },
};
