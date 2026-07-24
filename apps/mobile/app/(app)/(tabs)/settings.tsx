import { useCallback, useState, type ReactNode } from "react";
import { View, Text, Pressable, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ban, ChevronRight, LogOut, FileText, Trash2 } from "lucide-react-native";
import { getMyProfile, logoutSession, updateProfile } from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";
import { pickAndUploadPhoto } from "../../../src/lib/photo";
import { AppScreen } from "../../../src/components/AppScreen";
import { ConfirmDialog, InlineNotice, StateView } from "../../../src/components/Foundation";
import { dark, space, type } from "../../../src/lib/theme";
import { serifFont } from "../../../src/lib/serif";

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
        setPhotoError(e instanceof Error ? e.message : "사진을 저장하지 못했어요. 다시 시도해 주세요.");
      }
    } else if (res.status === "denied") {
      setPhotoError("사진을 변경하려면 기기 설정에서 사진 접근을 허용해 주세요.");
    } else if (res.status === "error") {
      setPhotoError(res.message);
    }
    setPhotoBusy(false);
  }

  if (loading) {
    return (
      <AppScreen tone="dark" tabScreen body="plain">
        <StateView title="설정을 불러오고 있어요" loading dark />
      </AppScreen>
    );
  }
  if (loadError || !profile) {
    return (
      <AppScreen tone="dark" tabScreen body="plain">
        <StateView title="프로필을 불러오지 못했어요" actionLabel="다시 시도" onAction={load} dark />
      </AppScreen>
    );
  }

  return (
    <AppScreen tone="dark" tabScreen body="scroll" contentStyle={styles.content}>
      {/* editorial profile masthead */}
      <View style={styles.profile}>
        <TouchableOpacity
          onPress={onChangePhoto}
          disabled={photoBusy}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="프로필 사진 변경"
        >
          <DoodleAvatar uri={profile.photoUrl} name={profile.name} size={76} />
          {photoBusy ? (
            <View style={styles.photoBusy}>
              <ActivityIndicator color={dark.text} />
            </View>
          ) : null}
        </TouchableOpacity>
        <View style={styles.profileText}>
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
        </View>
      </View>
      {photoError ? (
        <View style={styles.photoNotice}>
          <InlineNotice tone="error" dark>
            {photoError}
          </InlineNotice>
        </View>
      ) : null}

      <Section label="안전">
        <Row icon={<Ban color={dark.text} size={19} strokeWidth={1.6} />} title="차단 목록 관리" last onPress={() =>
          // new route — Expo Router typegen updates on next `expo start`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push("/(app)/blocks" as any)
        } />
      </Section>

      <Section label="계정">
        <Row icon={<FileText color={dark.text} size={19} strokeWidth={1.6} />} title="이용약관" onPress={() => router.push("/terms")} />
        <Row icon={<FileText color={dark.text} size={19} strokeWidth={1.6} />} title="개인정보 처리 안내" onPress={() => router.push("/privacy")} />
        <Row icon={<LogOut color={dark.danger} size={19} strokeWidth={1.6} />} title="로그아웃" danger noChevron onPress={() => setLogoutOpen(true)} />
        <Row icon={<Trash2 color={dark.danger} size={19} strokeWidth={1.6} />} title="계정 삭제" danger last onPress={() => router.push("/(app)/delete-account")} />
      </Section>

      <ConfirmDialog
        dark
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

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  title,
  onPress,
  danger = false,
  last = false,
  noChevron = false,
}: {
  icon: ReactNode;
  title: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
  noChevron?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={[styles.rowTitle, danger && { color: dark.danger }]}>{title}</Text>
      {noChevron ? null : <ChevronRight color={dark.textMuted} size={19} strokeWidth={1.6} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.x4 },
  profile: { flexDirection: "row", alignItems: "center", gap: space.x4 },
  photoBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(26,18,12,0.6)",
    borderRadius: 40,
  },
  profileText: { flex: 1, minWidth: 0 },
  name: { fontFamily: serifFont, fontSize: 21, lineHeight: 27, color: dark.text, letterSpacing: -0.2 },
  meta: { ...type.caption, color: dark.textMuted, marginTop: 2 },
  photoLink: { ...type.caption, fontFamily: type.label.fontFamily, color: dark.accent, marginTop: space.x2 },
  photoLinkButton: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },
  photoNotice: { marginTop: space.x3 },
  section: { marginTop: space.x6 },
  sectionLabel: {
    fontFamily: type.label.fontFamily,
    fontSize: 11,
    letterSpacing: 2,
    color: dark.label,
    textTransform: "uppercase",
    marginBottom: space.x1,
  },
  sectionBody: {},
  row: { flexDirection: "row", alignItems: "center", gap: space.x3, minHeight: 54 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: dark.line },
  rowIcon: { width: 22, alignItems: "center" },
  rowTitle: { flex: 1, fontFamily: serifFont, fontSize: 15, color: dark.text },
});
