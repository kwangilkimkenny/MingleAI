import { useEffect, useState } from "react";
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/lib/client";
import { useAuthHydrated } from "../../src/lib/use-hydrated";
import { getMyProfile } from "@mingle/client-core";

type ProfileState = "loading" | "none" | "ok";

export default function AppLayout() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const [profileState, setProfileState] = useState<ProfileState>("loading");

  useEffect(() => {
    if (!hydrated || !token) return;
    let alive = true;
    setProfileState("loading");
    getMyProfile()
      .then((p) => { if (alive) setProfileState(p ? "ok" : "none"); })
      .catch(() => { if (alive) setProfileState("none"); });
    return () => { alive = false; };
  }, [hydrated, token]);

  if (!hydrated) return null;
  if (!token) return <Redirect href="/login" />;
  if (profileState === "loading") return null;
  if (profileState === "none") return <Redirect href="/onboarding" />;
  return <Stack screenOptions={{ headerTitle: "MingleAI" }} />;
}
