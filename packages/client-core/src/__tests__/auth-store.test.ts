import { describe, it, expect } from "vitest";
import { createAuthStore } from "../auth-store.js";
import { createMemoryStorage } from "../storage.js";

describe("createAuthStore", () => {
  it("starts logged out", () => {
    const store = createAuthStore(createMemoryStorage());
    expect(store.getState().token).toBeNull();
    expect(store.getState().isAdmin()).toBe(false);
  });

  it("sets auth and clears on logout", () => {
    const store = createAuthStore(createMemoryStorage());
    store.getState().setAuth({ token: "t", profileId: "p", role: "admin" });
    expect(store.getState().token).toBe("t");
    expect(store.getState().profileId).toBe("p");
    expect(store.getState().isAdmin()).toBe(true);
    store.getState().logout();
    expect(store.getState().token).toBeNull();
    expect(store.getState().role).toBeNull();
  });

  it("preserves existing profileId when setAuth omits it", () => {
    const store = createAuthStore(createMemoryStorage());
    store.getState().setAuth({ token: "t1", profileId: "p1" });
    store.getState().setAuth({ token: "t2" });
    expect(store.getState().profileId).toBe("p1");
    expect(store.getState().token).toBe("t2");
  });

  it("rehydrates persisted state from storage and exposes the persist API", async () => {
    const storage = createMemoryStorage();
    await storage.setItem(
      "mingle-auth",
      JSON.stringify({ state: { token: "saved", profileId: "p", role: "user" }, version: 0 }),
    );
    const store = createAuthStore(storage);
    await store.persist.rehydrate();
    expect(store.getState().token).toBe("saved");
  });

  it("stays logged out and does not throw when stored JSON is corrupt", async () => {
    const storage = createMemoryStorage();
    await storage.setItem("mingle-auth", "{ not valid json");
    const store = createAuthStore(storage);
    await store.persist.rehydrate();
    expect(store.getState().token).toBeNull();
  });
});
