import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ApiError, deleteAccount } from "@mingle/client-core";
import { useAuthStore } from "../../src/lib/client";
import { dark, space } from "../../src/lib/theme";
import { DoodleButton } from "../../src/components/Doodle";
import { AppScreen } from "../../src/components/AppScreen";
import { InlineNotice, LabeledInput } from "../../src/components/Foundation";

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
      setError(reason instanceof ApiError ? reason.message : "계정을 삭제하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen
      tone="dark"
      keyboardAware
      header={{ back: true, title: "계정 삭제" }}
      footer={
        <DoodleButton
          title={busy ? "삭제 중…" : "계정 영구 삭제"}
          onPress={submit}
          disabled={busy || confirmation.trim() !== "탈퇴"}
          variant="dangerSolid"
          tone="dark"
          serious
        />
      }
    >
      <View style={styles.form}>
        <InlineNotice tone="error" dark>
          삭제 후에는 복구할 수 없어요. 프로필, 매칭, 채팅, 데이트 계획과 소개팅 참여 기록이 계정과 함께 삭제됩니다.
        </InlineNotice>
        <LabeledInput
          label="확인 문구"
          hint="계속하려면 ‘탈퇴’를 입력해 주세요."
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="none"
          dark
        />
        {error ? (
          <InlineNotice tone="error" dark>
            {error}
          </InlineNotice>
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.x5 },
});
