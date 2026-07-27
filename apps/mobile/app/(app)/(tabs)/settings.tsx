import { useCallback, useState, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ban, ChevronRight, LogOut, FileText, Trash2 } from "lucide-react-native";
import { logoutSession, getMyProfile } from "@mingle/client-core";

type MyProfile = Awaited<ReturnType<typeof getMyProfile>>;
import { useAuthStore } from "../../../src/lib/client";
import { AppScreen } from "../../../src/components/AppScreen";
import { ConfirmDialog } from "../../../src/components/Foundation";
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";
import { dark, space, type } from "../../../src/lib/theme";
import { serifFont } from "../../../src/lib/serif";

const GENDER_LABEL: Record<string, string> = {
  male: "남성",
  female: "여성",
  non_binary: "논바이너리",
  prefer_not_to_say: "비공개",
};

export default function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [profile, setProfile] = useState<MyProfile>(null);

  // 상단 = 보는 영역(내 프로필 요약), 하단 = 누르는 영역 — 썸존 재배치(2026-07-27 감사).
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getMyProfile()
        .then((p) => {
          if (alive) setProfile(p);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <AppScreen tone="dark" tabScreen body="scroll" contentStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="내 정보 수정"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onPress={() => router.push("/(app)/profile-edit" as any)}
        style={({ pressed }) => [styles.profileCard, pressed && { opacity: 0.8 }]}
      >
        <DoodleAvatar uri={profile?.photoUrl} name={profile?.name ?? ""} size={56} />
        <View style={styles.profileText}>
          <Text style={styles.profileName}>{profile?.name ?? "내 정보"}</Text>
          <Text style={styles.profileMeta}>
            {profile
              ? `${profile.age}세 · ${GENDER_LABEL[profile.gender] ?? profile.gender}${profile.occupation ? ` · ${profile.occupation}` : ""}`
              : "프로필을 불러오고 있어요"}
          </Text>
        </View>
        <ChevronRight color={dark.textMuted} size={19} strokeWidth={1.6} />
      </Pressable>

      <Section label="안전">
        <Row
          icon={<Ban color={dark.text} size={19} strokeWidth={1.6} />}
          title="차단 목록 관리"
          last
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push("/(app)/blocks" as any)}
        />
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
      <View>{children}</View>
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
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    padding: space.x4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
  },
  profileText: { flex: 1, gap: 2 },
  profileName: { fontFamily: serifFont, fontSize: 19, color: dark.text },
  profileMeta: { ...type.caption, color: dark.textMuted },
  section: { marginTop: space.x6 },
  sectionLabel: {
    fontFamily: type.label.fontFamily,
    fontSize: 11,
    letterSpacing: 2,
    color: dark.label,
    textTransform: "uppercase",
    marginBottom: space.x1,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.x3, minHeight: 54 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: dark.line },
  rowIcon: { width: 22, alignItems: "center" },
  rowTitle: { flex: 1, fontFamily: serifFont, fontSize: 15, color: dark.text },
});
