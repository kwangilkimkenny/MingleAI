import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/lib/client";
import { useAuthHydrated } from "../../src/lib/use-hydrated";

export default function AppLayout() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  if (!hydrated) return null;
  if (!token) return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerTitle: "MingleAI" }} />;
}
