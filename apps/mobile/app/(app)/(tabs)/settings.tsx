import { useCallback, type ReactNode, useState } from "react";
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
import { Ban, LogOut, ChevronRight } from "lucide-react-native";
import { getMyProfile, updateProfile } from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";
import { DashedLine } from "../../../src/components/DoodleSvg";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { pickAndUploadPhoto } from "../../../src/lib/photo";
import { colors, fonts } from "../../../src/lib/theme";

type MyProfile = NonNullable<Awaited<ReturnType<typeof getMyProfile>>>;

export default function SettingsScreen() {
  const clearance = useTabBarClearance();
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
    <View style={[styles.container, { paddingBottom: clearance }]}>
      <View style={styles.summary}>
        {loading ? (
          <ActivityIndicator color={colors.ink} />
        ) : profile ? (
          <>
            <TouchableOpacity
              onPress={onChangePhoto}
              disabled={photoBusy}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="프로필 사진 변경"
            >
              <DoodleAvatar uri={profile.photoUrl} name={profile.name} size={92} />
              {photoBusy ? (
                <View style={styles.photoBusy}>
                  <ActivityIndicator color={colors.ink} />
                </View>
              ) : null}
            </TouchableOpacity>
            <Text style={styles.name}>
              {profile.name} · {profile.age}
            </Text>
            <Text style={styles.meta}>
              {[profile.occupation, profile.location].filter(Boolean).join(" · ")}
            </Text>
            <Text style={styles.photoLink} onPress={onChangePhoto}>
              {profile.photoUrl ? "사진 변경" : "사진 추가"}
            </Text>
          </>
        ) : (
          <Text style={styles.meta}>프로필을 불러오지 못했어요.</Text>
        )}
      </View>

      <View style={styles.rows}>
        <View style={styles.separatorWrap}>
          <DashedLine />
        </View>
        <Row
          icon={<Ban color={colors.ink} size={20} strokeWidth={2} />}
          label="차단 목록 관리"
          chevron
          onPress={() =>
            // new route — Expo Router typegen updates on next `expo start`
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.push("/(app)/blocks" as any)
          }
        />
        <View style={styles.separatorWrap}>
          <DashedLine />
        </View>
        <Row
          icon={<LogOut color={colors.ink} size={20} strokeWidth={2} />}
          label="로그아웃"
          onPress={logout}
        />
        <View style={styles.separatorWrap}>
          <DashedLine />
        </View>
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  onPress,
  chevron = false,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  chevron?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowLeft}>
        {icon}
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      {chevron ? <ChevronRight color={colors.grayMid} size={20} strokeWidth={2} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: 20, gap: 28 },
  summary: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    minHeight: 96,
    justifyContent: "center",
  },
  photoBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 46,
  },
  name: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, marginTop: 10 },
  meta: { fontSize: 14, color: colors.grayMid },
  photoLink: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
    textDecorationLine: "underline",
    marginTop: 2,
  },
  rows: {},
  separatorWrap: { width: "100%" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowLabel: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
});
