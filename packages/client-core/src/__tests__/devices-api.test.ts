import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../api/client.js";
import {
  registerDevice,
  unregisterDevice,
  setPushEnabled,
  getNotifications,
  markNotificationRead,
  getUnreadCount,
  markAllNotificationsRead,
} from "../index.js";

const fetchMock = vi.spyOn(client, "apiFetch").mockResolvedValue(undefined as never);
beforeEach(() => fetchMock.mockClear());

describe("devices + notifications API", () => {
  it("registerDevice POSTs token+platform", async () => {
    await registerDevice("ExponentPushToken[a]", "ios");
    expect(fetchMock).toHaveBeenCalledWith("/devices", {
      method: "POST",
      body: JSON.stringify({ token: "ExponentPushToken[a]", platform: "ios" }),
    });
  });
  it("unregisterDevice DELETEs by token", async () => {
    await unregisterDevice("ExponentPushToken[a]");
    expect(fetchMock).toHaveBeenCalledWith("/devices/ExponentPushToken[a]", { method: "DELETE" });
  });
  it("setPushEnabled PATCHes the toggle", async () => {
    await setPushEnabled(false);
    expect(fetchMock).toHaveBeenCalledWith("/users/me/push", {
      method: "PATCH",
      body: JSON.stringify({ pushEnabled: false }),
    });
  });
  it("getNotifications GETs with paging query", async () => {
    await getNotifications(20, 0);
    expect(fetchMock).toHaveBeenCalledWith("/notifications?limit=20&offset=0");
  });
  it("markNotificationRead PATCHes the item", async () => {
    await markNotificationRead("n1");
    expect(fetchMock).toHaveBeenCalledWith("/notifications/n1/read", { method: "PATCH" });
  });
  it("getUnreadCount GETs unread-count", async () => {
    await getUnreadCount();
    expect(fetchMock).toHaveBeenCalledWith("/notifications/unread-count");
  });
  it("markAllNotificationsRead POSTs read-all", async () => {
    await markAllNotificationsRead();
    expect(fetchMock).toHaveBeenCalledWith("/notifications/read-all", { method: "POST" });
  });
});
