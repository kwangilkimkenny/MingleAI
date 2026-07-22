import { Redirect } from "expo-router";
import { useAuthStore } from "../src/lib/client";
import { useAuthHydrated } from "../src/lib/use-hydrated";

export default function Index() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  if (!hydrated) return null;
  // Social-only auth: unauthenticated users go to the social login screen. The (app) gate ladder
  // then walks them through consent → permissions → identity → profile.
  return <Redirect href={token ? "/home" : "/login"} />;
}
