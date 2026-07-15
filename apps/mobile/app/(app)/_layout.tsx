import { colors, doodleHeaderOptions } from "../../src/lib/theme";
import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/lib/client";
import { useAuthHydrated } from "../../src/lib/use-hydrated";
import { getMyProfile } from "@mingle/client-core";
import { usePushRegistration } from "../../src/lib/push";

type ProfileState = "loading" | "none" | "ok" | "error";

export default function AppLayout() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [profileState, setProfileState] = useState<ProfileState>("loading");

  const fetchProfile = useCallback(() => {
    if (!hydrated || !token) return;
    let alive = true;
    setProfileState("loading");
    getMyProfile()
      .then((p) => {
        if (!alive) return;
        if (p) {
          setAuth({ token: token!, profileId: p.id });
          setProfileState("ok");
        } else {
          setProfileState("none");
        }
      })
      .catch(() => {
        if (alive) setProfileState("error");
      });
    return () => {
      alive = false;
    };
  }, [hydrated, token, setAuth]);

  useEffect(() => {
    return fetchProfile();
  }, [fetchProfile]);

  usePushRegistration(profileState === "ok");

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
  return (
    <Stack
      screenOptions={{
        ...doodleHeaderOptions,
        headerShown: false,
        // 내비게이터 기본 배경(#F2F2F2)이 전환 틈에 비치지 않게 종이색으로 고정.
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      {/* The fixed bottom-tab surface owns its own headers */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Detail screens push OVER the tabs with a back button */}
      <Stack.Screen name="matching" options={{ title: "매칭" }} />
      <Stack.Screen name="blocks" options={{ title: "차단 목록" }} />
      <Stack.Screen name="chat/[roomId]" options={{ title: "채팅" }} />
      <Stack.Screen name="party/[id]" options={{ title: "파티" }} />
      <Stack.Screen name="date-plan/[matchId]" options={{ title: "데이트 플랜" }} />
      <Stack.Screen name="report/[profileId]" options={{ title: "신고" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  errorText: { fontSize: 16, color: colors.grayDark },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: { color: colors.ink, fontSize: 15 },
});
