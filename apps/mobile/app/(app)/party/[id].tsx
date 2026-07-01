import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Button, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getMatchmakingStatus, ApiError } from "@mingle/client-core";
import type { PublicParty } from "@mingle/client-core";

export default function PartyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [party, setParty] = useState<PublicParty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    getMatchmakingStatus()
      .then((s) => {
        if (!alive.current) return;
        if (s.party && s.party.id === id) setParty(s.party);
        else setError("파티 정보를 찾을 수 없습니다.");
      })
      .catch((e) => {
        if (alive.current) setError(e instanceof ApiError ? e.message : "불러오기 실패");
      });
    return () => {
      alive.current = false;
    };
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Button title="홈으로" onPress={() => router.replace("/(app)/home")} />
      </View>
    );
  }
  if (!party) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{party.name}</Text>
      <Text style={styles.sub}>곧 파티가 시작됩니다 · {party.participants.length}명</Text>
      {party.participants.map((p) => (
        <View key={p.profileId} style={styles.card}>
          <Text style={styles.name}>{p.name} · {p.age}</Text>
          <Text style={styles.meta}>{p.occupation}</Text>
          {p.preferenceSummary ? <Text style={styles.summary}>{p.preferenceSummary}</Text> : null}
        </View>
      ))}
      <Button title="홈으로" onPress={() => router.replace("/(app)/home")} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 24 },
  container: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "600" },
  sub: { fontSize: 13, color: "#888", marginBottom: 8 },
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 12, gap: 4 },
  name: { fontSize: 16, fontWeight: "500" },
  meta: { fontSize: 13, color: "#555" },
  summary: { fontSize: 13, color: "#777" },
  error: { color: "red", textAlign: "center" },
});
