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
});
