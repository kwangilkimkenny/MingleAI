import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError, deleteAccount } from "@mingle/client-core";
import { useAuthStore } from "../../src/lib/client";
import { colors, layout, space, type } from "../../src/lib/theme";
import { DoodleButton } from "../../src/components/Doodle";
import { ContentColumn, InlineNotice, LabeledInput, PageHeader } from "../../src/components/Foundation";

export default function DeleteAccountScreen() {
  const logout = useAuthStore((state) => state.logout);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy || confirmation.trim() !== "탈퇴") return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      logout();
      router.replace("/login");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "계정을 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ContentColumn style={styles.column}>
          <PageHeader back title="계정 삭제" description="삭제 전에 아래 내용을 꼭 확인해 주세요." />
          <View style={styles.warning}>
            <Text style={styles.warningTitle}>삭제 후에는 복구할 수 없어요</Text>
            <Text style={styles.warningBody}>프로필, 매칭, 프로포즈, 채팅, 데이트 계획과 게임 참여 기록이 계정과 함께 삭제됩니다.</Text>
          </View>
          <LabeledInput label="확인 문구" hint="계속하려면 ‘탈퇴’를 입력하세요." value={confirmation} onChangeText={setConfirmation} autoCapitalize="none" />
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          <DoodleButton title={busy ? "삭제 중..." : "계정 영구 삭제"} onPress={submit} disabled={busy || confirmation.trim() !== "탈퇴"} variant="dangerSolid" serious />
        </ContentColumn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, paddingHorizontal: layout.screenGutter, paddingBottom: space.x8 },
  column: { gap: space.x5 },
  warning: { gap: space.x2, padding: space.x4, borderRadius: 16, backgroundColor: colors.dangerFill },
  warningTitle: { ...type.title, color: colors.danger },
  warningBody: { ...type.body, color: colors.ink },
});
