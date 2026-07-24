import { useState } from "react";
import { View, Text, StyleSheet, Linking } from "react-native";
import { router } from "expo-router";
import { Camera, Mic } from "lucide-react-native";
import { AppScreen } from "../src/components/AppScreen";
import { DoodleButton, DoodleCard } from "../src/components/Doodle";
import { InlineNotice } from "../src/components/Foundation";
import { requestCameraMic, isPermanentlyDenied } from "../src/lib/permissions";
import { colors, space, type } from "../src/lib/theme";

export default function Permissions() {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [missing, setMissing] = useState<string | null>(null);

  async function onRequest() {
    setBusy(true);
    setMissing(null);
    try {
      const state = await requestCameraMic();
      if (state.camera && state.microphone) {
        router.replace("/home");
        return;
      }
      const need = [!state.camera && "카메라", !state.microphone && "마이크"].filter(Boolean);
      setMissing(need.length ? `${need.join("·")} 권한이 아직 허용되지 않았어요.` : null);
      setBlocked(await isPermanentlyDenied());
    } catch {
      setBlocked(true);
    } finally {
      setBusy(false);
    }
  }

  const footer = blocked ? (
    <View style={styles.footerStack}>
      <DoodleButton title="설정 열기" onPress={() => Linking.openSettings()} variant="primary" />
      <DoodleButton title="다시 확인" onPress={onRequest} />
    </View>
  ) : (
    <DoodleButton
      title={busy ? "요청 중…" : "권한 허용하기"}
      onPress={onRequest}
      disabled={busy}
      variant="primary"
    />
  );

  return (
    <AppScreen header={{ title: "카메라·마이크 권한" }} footer={footer}>
      <View style={styles.body}>
        <DoodleCard tone="fill" contentStyle={styles.card}>
          <Row
            icon={<Camera color={colors.accent} size={20} strokeWidth={1.75} />}
            title="카메라"
            body="얼굴 공개 단계의 영상 통화에 사용해요."
          />
          <Row
            icon={<Mic color={colors.accent} size={20} strokeWidth={1.75} />}
            title="마이크"
            body="모든 대화의 음성에 사용해요."
          />
        </DoodleCard>

        {blocked ? (
          <InlineNotice tone="error">
            권한이 거부되어 있어요. 설정에서 카메라·마이크를 허용한 뒤 다시 시도해 주세요.
          </InlineNotice>
        ) : missing ? (
          <InlineNotice tone="error">{missing}</InlineNotice>
        ) : null}

        <Text style={styles.note}>권한 없이는 서비스를 이용할 수 없어요.</Text>
      </View>
    </AppScreen>
  );
}

function Row({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.x4 },
  card: { gap: space.x3 },
  footerStack: { gap: space.x2 },
  row: { flexDirection: "row", gap: space.x3, alignItems: "center" },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { ...type.label, color: colors.ink },
  rowBody: { ...type.caption, color: colors.grayDark },
  note: { ...type.caption, color: colors.grayDark, textAlign: "center" },
});
