import { useCallback, type ReactNode, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ban, LogOut, ChevronRight, FileText, Trash2 } from "lucide-react-native";
import { getMyProfile, logoutSession, updateProfile } from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";
import { DashedLine } from "../../../src/components/DoodleSvg";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { pickAndUploadPhoto } from "../../../src/lib/photo";
import { colors, layout, shadow, space, type } from "../../../src/lib/theme";
import {
  ConfirmDialog,
  ContentColumn,
  InlineNotice,
  PageHeader,
  StateView,
} from "../../../src/components/Foundation";

type MyProfile = NonNullable<Awaited<ReturnType<typeof getMyProfile>>>;

export default function SettingsScreen() {
  const clearance = useTabBarClearance();
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingBottom: clearance }]}
    >
      <ContentColumn style={styles.column}>
        <View style={styles.summary}>
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
          </>
        </View>

        <View style={styles.rows}>
          <Text style={styles.sectionLabel}>안전</Text>
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
          <Text style={styles.sectionLabel}>계정</Text>
          <Row
            icon={<FileText color={colors.ink} size={20} strokeWidth={2} />}
            label="이용약관"
            chevron
            onPress={() => router.push("/terms")}
          />
          <Row
            icon={<FileText color={colors.ink} size={20} strokeWidth={2} />}
            label="개인정보 처리 안내"
            chevron
            onPress={() => router.push("/privacy")}
          />
          <Row
            icon={<LogOut color={colors.danger} size={20} strokeWidth={2} />}
            label="로그아웃"
            danger
            onPress={() => setLogoutOpen(true)}
          />
          <Row
            icon={<Trash2 color={colors.danger} size={20} strokeWidth={2} />}
            label="계정 삭제"
            danger
            chevron
            onPress={() => router.push("/(app)/delete-account")}
          />
          <View style={styles.separatorWrap}>
            <DashedLine />
          </View>
        </View>
      </ContentColumn>
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
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  onPress,
  chevron = false,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  chevron?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowLeft}>
        {icon}
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      </View>
      {chevron ? <ChevronRight color={colors.grayMid} size={20} strokeWidth={2} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, backgroundColor: colors.paper, paddingHorizontal: layout.screenGutter },
  column: { gap: space.x6, paddingTop: space.x2 },
  summary: {
    alignItems: "center",
    gap: space.x1,
    paddingVertical: space.x6,
    minHeight: 180,
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    ...shadow.card,
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
  name: { ...type.title, color: colors.heading, marginTop: space.x2 },
  meta: { ...type.body, color: colors.grayDark },
  photoLink: {
    ...type.label,
    color: colors.ink,
    textDecorationLine: "underline",
  },
  photoLinkButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  photoNotice: { alignSelf: "stretch", marginHorizontal: space.x4, marginTop: space.x1 },
  rows: { gap: space.x1 },
  sectionLabel: { ...type.label, color: colors.grayDark, marginTop: space.x2 },
  separatorWrap: { width: "100%" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    paddingVertical: space.x3,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowLabel: { ...type.body, color: colors.ink },
  rowLabelDanger: { color: colors.danger },
});
