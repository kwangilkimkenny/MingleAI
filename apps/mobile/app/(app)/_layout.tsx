import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/lib/client";

export default function AppLayout() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerTitle: "MingleAI" }} />;
}
