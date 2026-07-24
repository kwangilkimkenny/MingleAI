import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ban, LogOut, FileText, Trash2 } from "lucide-react-native";
import { getMyProfile, logoutSession, updateProfile } from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";
import { AppScreen } from "../../../src/components/AppScreen";
import { DoodleCard } from "../../../src/components/Doodle";
import { ListRow, RowSeparator } from "../../../src/components/ListRow";
import { pickAndUploadPhoto } from "../../../src/lib/photo";
import { colors, space, type } from "../../../src/lib/theme";
import { ConfirmDialog, InlineNotice, StateView } from "../../../src/components/Foundation";

type MyProfile = NonNullable<Awaited<ReturnType<typeof getMyProfile>>>;

export default function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);
  const profileId = useAuthStore((s) => s.profileId);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setLoadError(false);
    getMyProfile()
      .then((p) => {
        if (alive) {
          setProfile(p);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setLoading(false);
          setLoadError(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(load);

  async function onChangePhoto() {
    if (photoBusy || !profileId) return;
    setPhotoError(null);
    setPhotoBusy(true);
    const res = await pickAndUploadPhoto();
    if (res.status === "ok") {
      try {
        const updated = await updateProfile(profileId, { photoUrl: res.url });
        setProfile((prev) => (prev ? { ...prev, photoUrl: updated.photoUrl } : prev));
      } catch (e) {
        setPhotoError(
          e instanceof Error ? e.message : "사진을 저장하지 못했어요. 다시 시도해 주세요.",
        );
      }
    } else if (res.status === "denied") {
      setPhotoError("사진을 변경하려면 기기 설정에서 사진 접근을 허용해 주세요.");
    } else if (res.status === "error") {
      setPhotoError(res.message);
    }
    setPhotoBusy(false);
  }

  if (loading) return <StateView title="설정을 불러오고 있어요" loading />;
  if (loadError || !profile) {
    return <StateView title="프로필을 불러오지 못했어요" actionLabel="다시 시도" onAction={load} />;
  }

  return (
    <AppScreen tabScreen header={{ title: "설정" }} body="scroll">
      <View style={styles.stack}>
        <DoodleCard contentStyle={styles.summary}>
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
          <Text accessibilityRole="header" style={styles.name}>
            {profile.name} · {profile.age}
          </Text>
          <Text style={styles.meta}>
            {[profile.occupation, profile.location].filter(Boolean).join(" · ")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={profile.photoUrl ? "프로필 사진 변경" : "프로필 사진 추가"}
            onPress={onChangePhoto}
            style={styles.photoLinkButton}
          >
            <Text style={styles.photoLink}>{profile.photoUrl ? "사진 변경" : "사진 추가"}</Text>
          </Pressable>
          {photoError ? (
            <View style={styles.photoNotice}>
              <InlineNotice tone="error">{photoError}</InlineNotice>
            </View>
          ) : null}
        </DoodleCard>

        <View>
          <Text style={styles.sectionLabel}>안전</Text>
          <DoodleCard contentStyle={styles.card}>
            <ListRow
              gutter={0}
              leading={<Ban color={colors.ink} size={20} strokeWidth={1.75} />}
              title="차단 목록 관리"
              onPress={() =>
                // new route — Expo Router typegen updates on next `expo start`
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                router.push("/(app)/blocks" as any)
              }
            />
          </DoodleCard>
        </View>

        <View>
          <Text style={styles.sectionLabel}>계정</Text>
          <DoodleCard contentStyle={styles.card}>
            <ListRow
              gutter={0}
              leading={<FileText color={colors.ink} size={20} strokeWidth={1.75} />}
              title="이용약관"
              onPress={() => router.push("/terms")}
            />
            <RowSeparator gutter={0} />
            <ListRow
              gutter={0}
              leading={<FileText color={colors.ink} size={20} strokeWidth={1.75} />}
              title="개인정보 처리 안내"
              onPress={() => router.push("/privacy")}
            />
            <RowSeparator gutter={0} />
            <ListRow
              gutter={0}
              tone="danger"
              leading={<LogOut color={colors.danger} size={20} strokeWidth={1.75} />}
              title="로그아웃"
              trailing={<View />}
              onPress={() => setLogoutOpen(true)}
            />
            <RowSeparator gutter={0} />
            <ListRow
              gutter={0}
              tone="danger"
              leading={<Trash2 color={colors.danger} size={20} strokeWidth={1.75} />}
              title="계정 삭제"
              onPress={() => router.push("/(app)/delete-account")}
            />
          </DoodleCard>
        </View>
      </View>

      <ConfirmDialog
        visible={logoutOpen}
        title="로그아웃할까요?"
        body="다시 로그인하면 채팅과 프로포즈를 이어서 확인할 수 있어요."
        confirmLabel="로그아웃"
        destructive
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          if (refreshToken) void logoutSession(refreshToken).catch(() => undefined);
          logout();
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.x5, paddingTop: space.x2 },
  summary: { alignItems: "center", gap: space.x1, paddingVertical: space.x4 },
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
  name: { ...type.title, color: colors.heading, marginTop: space.x2 },
  meta: { ...type.body, color: colors.grayDark },
  photoLink: { ...type.label, color: colors.ink, textDecorationLine: "underline" },
  photoLinkButton: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  photoNotice: { alignSelf: "stretch", marginTop: space.x1 },
  sectionLabel: {
    ...type.label,
    color: colors.grayMid,
    marginBottom: space.x3,
    marginLeft: space.x1,
  },
  card: { paddingVertical: space.x1, paddingHorizontal: space.x4 },
});
