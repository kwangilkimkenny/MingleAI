import { Redirect } from "expo-router";
import { useAuthStore } from "../src/lib/client";
import { useAuthHydrated } from "../src/lib/use-hydrated";

export default function Index() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  if (!hydrated) return null;
  return <Redirect href={token ? "/(app)/home" : "/login"} />;
}
