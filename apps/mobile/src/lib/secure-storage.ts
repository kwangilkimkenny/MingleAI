import * as SecureStore from "expo-secure-store";
import type { KeyValueStorage } from "@mingle/client-core";

export const secureStorage: KeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
