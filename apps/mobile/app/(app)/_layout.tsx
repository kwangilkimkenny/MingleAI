import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/lib/client";
import { useAuthHydrated } from "../../src/lib/use-hydrated";
import { getMyProfile } from "@mingle/client-core";

type ProfileState = "loading" | "none" | "ok" | "error";

export default function AppLayout() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const [profileState, setProfileState] = useState<ProfileState>("loading");

  const fetchProfile = useCallback(() => {
    if (!hydrated || !token) return;
    let alive = true;
    setProfileState("loading");
    getMyProfile()
      .then((p) => { if (alive) setProfileState(p ? "ok" : "none"); })
      .catch(() => { if (alive) setProfileState("error"); });
    return () => { alive = false; };
  }, [hydrated, token]);

  useEffect(() => {
    return fetchProfile();
  }, [fetchProfile]);

  if (!hydrated) return null;
  if (!token) return <Redirect href="/login" />;
  if (profileState === "loading") return null;
  if (profileState === "none") return <Redirect href="/onboarding" />;
  if (profileState === "error") {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>연결에 문제가 생겼습니다.</Text>
        <Pressable style={styles.retryButton} onPress={fetchProfile}>
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }
  return <Stack screenOptions={{ headerTitle: "MingleAI" }} />;
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  errorText: { fontSize: 16, color: "#444" },
  retryButton: {
    borderWidth: 1,
    borderColor: "#6200ee",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: { color: "#6200ee", fontSize: 15 },
});
