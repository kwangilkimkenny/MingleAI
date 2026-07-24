import { useState, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ban, ChevronRight, LogOut, FileText, Trash2, UserRound } from "lucide-react-native";
import { logoutSession } from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";
import { AppScreen } from "../../../src/components/AppScreen";
import { ConfirmDialog } from "../../../src/components/Foundation";
import { dark, space, type } from "../../../src/lib/theme";
import { serifFont } from "../../../src/lib/serif";

export default function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <AppScreen tone="dark" tabScreen body="scroll" contentStyle={styles.content}>
      <Section label="프로필">
        <Row
          icon={<UserRound color={dark.text} size={19} strokeWidth={1.6} />}
          title="내 정보"
          last
          // new route — Expo Router typegen updates on next `expo start`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push("/(app)/profile-edit" as any)}
        />
      </Section>

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
