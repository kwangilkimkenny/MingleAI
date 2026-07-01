import { useEffect, useRef, useState } from "react";
import { View, Text, Button, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import {
  enqueueMatchmaking,
  cancelMatchmaking,
  getMatchmakingStatus,
  ApiError,
} from "@mingle/client-core";

const POLL_MS = 2500;

export default function Matching() {
  const [phase, setPhase] = useState<"joining" | "waiting" | "failed" | "error">("joining");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const alive = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    alive.current = true;

    async function poll() {
      try {
        const s = await getMatchmakingStatus();
        if (!alive.current) return;
        // FIX B: matched is terminal regardless of whether matchedPartyId is present.
        if (s.status === "matched") {
          if (s.matchedPartyId) {
            router.replace({ pathname: "/(app)/party/[id]", params: { id: s.matchedPartyId } });
          } else {
            setPhase("failed");
          }
          return;
        }
        if (s.status === "cancelled" || s.status === "none") {
          setPhase("failed");
          return;
        }
        setPhase("waiting");
        setElapsed(s.elapsedMs ?? 0);
        timerRef.current = setTimeout(poll, POLL_MS);
      } catch (e) {
        if (!alive.current) return;
        setError(e instanceof ApiError ? e.message : "매칭 상태를 불러오지 못했습니다.");
        setPhase("error");
      }
    }

    (async () => {
      try {
        await enqueueMatchmaking();
        if (!alive.current) return;
        setPhase("waiting");
        poll();
      } catch (e) {
        if (!alive.current) return;
        setError(e instanceof ApiError ? e.message : "매칭을 시작하지 못했습니다.");
        setPhase("error");
      }
    })();

    return () => {
      alive.current = false;
      clearTimeout(timerRef.current);
    };
  }, []);

  async function onCancel() {
    alive.current = false;
    clearTimeout(timerRef.current);
    try {
      await cancelMatchmaking();
    } catch {
      // ignore — leaving the screen is the intent
    }
    router.replace("/(app)/home");
  }

  if (phase === "failed") {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>지금은 매칭이 어려워요. 잠시 후 다시 시도해 주세요.</Text>
        <Button title="다시 시도" onPress={() => router.replace("/(app)/matching")} />
        <Button title="홈으로" onPress={() => router.replace("/(app)/home")} />
      </View>
    );
  }
  if (phase === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Button title="홈으로" onPress={() => router.replace("/(app)/home")} />
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" />
      <Text style={styles.msg}>매칭 중...</Text>
      {phase === "waiting" ? (
        <Text style={styles.sub}>{Math.floor(elapsed / 1000)}초 경과</Text>
      ) : (
        <Text style={styles.sub}>매칭 준비 중...</Text>
      )}
      <Button title="취소" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 24 },
  msg: { fontSize: 16, color: "#333" },
  sub: { fontSize: 13, color: "#888" },
  error: { color: "red", textAlign: "center" },
});
