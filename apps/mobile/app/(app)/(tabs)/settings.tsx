import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getMyProfile, updateProfile } from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";
import { pickAndUploadPhoto } from "../../../src/lib/photo";

const INK = "#17150F";
const PAPER = "#FFFFFF";
const GRAY_MED = "#8A857C";
const GRAY_DARK = "#45413A";
const GRAY_LIGHT = "#D9D5CC";

type MyProfile = NonNullable<Awaited<ReturnType<typeof getMyProfile>>>;

export default function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);
  const profileId = useAuthStore((s) => s.profileId);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoBusy, setPhotoBusy] = useState(false);

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

  async function onChangePhoto() {
    if (photoBusy || !profileId) return;
    setPhotoBusy(true);
    const res = await pickAndUploadPhoto();
    if (res.status === "ok") {
      try {
        const updated = await updateProfile(profileId, { photoUrl: res.url });
        setProfile((prev) => (prev ? { ...prev, photoUrl: updated.photoUrl } : prev));
      } catch (e) {
        Alert.alert("사진 저장 실패", e instanceof Error ? e.message : "다시 시도해 주세요.");
      }
    } else if (res.status === "denied") {
      Alert.alert("사진 접근 권한 필요", "설정에서 사진 접근을 허용해 주세요.");
    } else if (res.status === "error") {
      Alert.alert("사진 업로드 실패", res.message);
    }
    setPhotoBusy(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        {loading ? (
          <ActivityIndicator color={INK} />
        ) : profile ? (
          <View style={styles.summaryRow}>
            <TouchableOpacity
              onPress={onChangePhoto}
              disabled={photoBusy}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="프로필 사진 변경"
            >
              <DoodleAvatar uri={profile.photoUrl} name={profile.name} size={64} />
              {photoBusy ? (
                <View style={styles.photoBusy}>
                  <ActivityIndicator color={INK} />
                </View>
              ) : null}
            </TouchableOpacity>
            <View style={styles.summaryText}>
              <Text style={styles.name}>
                {profile.name} · {profile.age}
              </Text>
              <Text style={styles.meta}>{profile.occupation}</Text>
              <Text style={styles.photoLink} onPress={onChangePhoto}>
                {profile.photoUrl ? "사진 변경" : "사진 추가"}
              </Text>
            </View>
          </View>
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
  container: { flex: 1, backgroundColor: PAPER, padding: 20, paddingBottom: 84, gap: 12 }, // clears the floating doodle tab bar
  summary: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 12,
    padding: 16,
    minHeight: 96,
    justifyContent: "center",
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  summaryText: { flex: 1, gap: 3 },
  photoBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 32,
  },
  photoLink: {
    fontSize: 13,
    fontWeight: "700",
    color: INK,
    textDecorationLine: "underline",
    marginTop: 2,
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
