import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { router } from "expo-router";
import { registerDevice, unregisterDevice } from "@mingle/client-core";
import { routeForNotification, type NotificationData } from "./route-for-notification";

// Foreground: show the banner (MVP).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function acquireAndRegisterToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators don't get Expo push tokens
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (
    await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
  ).data;
  await registerDevice(token, Platform.OS === "ios" ? "ios" : "android");
  return token;
}

/** Mount in the authenticated layout. Registers the token + wires the tap listener. */
export function usePushRegistration(enabled: boolean) {
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    acquireAndRegisterToken()
      .then((t) => {
        if (alive) tokenRef.current = t;
      })
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as unknown as NotificationData;
      router.push(routeForNotification(data));
    });

    return () => {
      alive = false;
      sub.remove();
      const t = tokenRef.current;
      if (t) unregisterDevice(t).catch(() => {}); // best-effort on unmount/logout
    };
  }, [enabled]);
}
