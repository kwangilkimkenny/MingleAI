import { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getMyProfile } from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";

const INK = "#17150F";
const PAPER = "#FFFFFF";
const GRAY_MED = "#8A857C";
const GRAY_DARK = "#45413A";
const GRAY_LIGHT = "#D9D5CC";

type MyProfile = NonNullable<Awaited<ReturnType<typeof getMyProfile>>>;

export default function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    getMyProfile()
      .then((p) => {
        if (alive) {
          setProfile(p);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(load);

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        {loading ? (
          <ActivityIndicator color={INK} />
        ) : profile ? (
          <>
            <Text style={styles.name}>
              {profile.name} · {profile.age}
            </Text>
            <Text style={styles.meta}>{profile.occupation}</Text>
          </>
        ) : (
          <Text style={styles.meta}>프로필을 불러오지 못했어요.</Text>
        )}
      </View>

      <Pressable
        style={styles.rowItem}
        onPress={() =>
          // new route — Expo Router typegen updates on next `expo start`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push("/(app)/blocks" as any)
        }
      >
        <Text style={styles.rowText}>차단 목록 관리</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={styles.rowItem} onPress={logout}>
        <Text style={[styles.rowText, styles.danger]}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER, padding: 20, gap: 12 },
  summary: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 12,
    padding: 16,
    gap: 4,
    minHeight: 72,
    justifyContent: "center",
  },
  name: { fontSize: 18, fontWeight: "700", color: INK },
  meta: { fontSize: 14, color: GRAY_DARK },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: GRAY_LIGHT,
    paddingVertical: 16,
  },
  rowText: { fontSize: 16, color: INK },
  danger: { fontWeight: "700" },
  chevron: { fontSize: 20, color: GRAY_MED },
});
