import { colors, doodleHeaderOptions } from "../../src/lib/theme";
import { useEffect, useState, useCallback } from "react";
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/lib/client";
import { useAuthHydrated } from "../../src/lib/use-hydrated";
import { getAccountStatus, getMyProfile, nextGate, type GateStep } from "@mingle/client-core";
import { getCameraMicStatus } from "../../src/lib/permissions";
import { usePushRegistration } from "../../src/lib/push";
import { StateView } from "../../src/components/Foundation";

type Phase = "loading" | "error" | GateStep;

export default function AppLayout() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [phase, setPhase] = useState<Phase>("loading");

  // Onboarding gate ladder: consent → camera/mic permission → identity → profile → ready.
  const resolveGate = useCallback(() => {
    if (!hydrated || !token) return;
    let alive = true;
    setPhase("loading");
    (async () => {
      try {
        const [status, perms] = await Promise.all([getAccountStatus(), getCameraMicStatus()]);
        if (!alive) return;
        const gate = nextGate(status, perms);
        if (gate === "ready") {
          const profile = await getMyProfile();
          if (!alive) return;
          if (profile) setAuth({ token, profileId: profile.id });
        }
        if (alive) setPhase(gate);
      } catch {
        if (alive) setPhase("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [hydrated, token, setAuth]);

  useEffect(() => resolveGate(), [resolveGate]);

  usePushRegistration(phase === "ready");

  if (!hydrated) return <StateView title="계정을 확인하고 있어요" loading />;
  if (!token) return <Redirect href="/login" />;
  if (phase === "loading") return <StateView title="준비 상태를 확인하고 있어요" loading />;
  if (phase === "error") {
    return (
      <StateView
        title="연결에 문제가 생겼어요"
        body="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        actionLabel="다시 시도"
        onAction={resolveGate}
      />
    );
  }
  if (phase === "consent") return <Redirect href="/consent" />;
  if (phase === "permissions") return <Redirect href="/permissions" />;
  if (phase === "identity") return <Redirect href="/verify-identity" />;
  if (phase === "profile") return <Redirect href="/onboarding" />;

  return (
    <Stack
      screenOptions={{
        ...doodleHeaderOptions,
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="matching" options={{ title: "매칭" }} />
      <Stack.Screen name="speed-date/index" options={{ title: "블라인드 데이트" }} />
      <Stack.Screen name="speed-date/[id]" options={{ title: "블라인드 데이트" }} />
      <Stack.Screen name="blocks" options={{ title: "차단 목록" }} />
      <Stack.Screen name="delete-account" options={{ title: "계정 삭제" }} />
      <Stack.Screen name="chat/[roomId]" options={{ title: "채팅" }} />
      <Stack.Screen name="party/[id]" options={{ title: "파티" }} />
      <Stack.Screen name="date-plan/[matchId]" options={{ title: "데이트 플랜" }} />
      <Stack.Screen name="report/[profileId]" options={{ title: "신고" }} />
    </Stack>
  );
}
