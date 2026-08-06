import { dark, doodleHeaderOptions } from "../../src/lib/theme";
import { useEffect, useRef, useState, useCallback } from "react";
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/lib/client";
import { useAuthHydrated } from "../../src/lib/use-hydrated";
import type { GateStep } from "@mingle/client-core";
import {
  resolveAccountGate,
  takePrimedAccountGate,
} from "../../src/lib/account-gate";
import { usePushRegistration } from "../../src/lib/push";
import { StateView } from "../../src/components/Foundation";

type Phase = "loading" | "error" | GateStep;

export default function AppLayout() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [initialGate] = useState(() => takePrimedAccountGate());
  const [phase, setPhase] = useState<Phase>(initialGate?.phase ?? "loading");
  const skipInitialResolve = useRef(initialGate !== null);

  // Onboarding gate ladder: identity → consent → profile → ready.
  // (camera/mic permission is requested right before entering a speed-date session, not here.)
  const resolveGate = useCallback(() => {
    if (!hydrated || !token) return;
    let alive = true;
    setPhase("loading");
    (async () => {
      try {
        const gate = await resolveAccountGate();
        if (!alive) return;
        if (gate.profileId) setAuth({ token, profileId: gate.profileId });
        if (alive) setPhase(gate.phase);
      } catch {
        if (alive) setPhase("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [hydrated, token, setAuth]);

  useEffect(() => {
    if (skipInitialResolve.current) {
      skipInitialResolve.current = false;
      return;
    }
    return resolveGate();
  }, [resolveGate]);

  usePushRegistration(phase === "ready");

  if (!hydrated) return <StateView title="계정을 확인하고 있어요" loading dark />;
  if (!token) return <Redirect href="/login" />;
  if (phase === "loading") return <StateView title="준비 상태를 확인하고 있어요" loading dark />;
  if (phase === "error") {
    return (
      <StateView
        title="연결에 문제가 생겼어요"
        body="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        actionLabel="다시 시도"
        onAction={resolveGate}
        dark
      />
    );
  }
  if (phase === "consent") return <Redirect href="/consent" />;
  if (phase === "identity") return <Redirect href="/verify-identity" />;
  if (phase === "profile") return <Redirect href="/onboarding" />;

  return (
    <Stack
      screenOptions={{
        ...doodleHeaderOptions,
        headerShown: false,
        contentStyle: { backgroundColor: dark.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="speed-date/index" options={{ title: "블라인드 데이트" }} />
      <Stack.Screen name="speed-date/[id]" options={{ title: "블라인드 데이트" }} />
      <Stack.Screen name="blocks" options={{ title: "차단 목록" }} />
      <Stack.Screen name="place-area" options={{ title: "위치 지정" }} />
      <Stack.Screen name="delete-account" options={{ title: "계정 삭제" }} />
      <Stack.Screen name="chat/[roomId]" options={{ title: "채팅" }} />
      <Stack.Screen name="date-plan/[matchId]" options={{ title: "데이트 플랜" }} />
      <Stack.Screen name="report/[profileId]" options={{ title: "신고" }} />
      {/* 공지 상세 = 홈 위에 살짝 투명하게 뜨는 오버레이(홈이 뒤로 비침). */}
      <Stack.Screen
        name="announcement"
        options={{
          presentation: "transparentModal",
          animation: "fade",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </Stack>
  );
}
