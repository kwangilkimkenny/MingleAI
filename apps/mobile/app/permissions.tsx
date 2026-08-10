import { useState } from "react";
import { View, Text, StyleSheet, Linking } from "react-native";
import { router } from "expo-router";
import { Camera, Mic } from "lucide-react-native";
import { AppScreen } from "../src/components/AppScreen";
import { DoodleButton, DoodleCard } from "../src/components/Doodle";
import { InlineNotice } from "../src/components/Foundation";
import { requestCameraMic, isPermanentlyDenied } from "../src/lib/permissions";
import { dark, space, type } from "../src/lib/theme";

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
        // 세션 진입 직전 프라이밍 화면(2026-07-27) — 허용되면 부른 흐름(스피드데이트)으로 복귀.
        if (router.canGoBack()) router.back();
        else router.replace("/home");
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
      <DoodleButton
        title="설정 열기"
        onPress={() => Linking.openSettings()}
        variant="primary"
        tone="dark"
      />
      <DoodleButton title="다시 확인" onPress={onRequest} tone="dark" />
    </View>
  ) : (
    <DoodleButton
      title={busy ? "요청 중…" : "권한 허용하기"}
      onPress={onRequest}
      disabled={busy}
      variant="primary"
      tone="dark"
    />
  );

  return (
    <AppScreen header={{ title: "카메라·마이크 권한" }} footer={footer} tone="dark">
      <View style={styles.body}>
        <DoodleCard tone="dark" contentStyle={styles.card}>
          <Row
            icon={<Camera color={dark.accent} size={20} strokeWidth={1.75} />}
            title="카메라"
            body="얼굴 공개 단계의 영상 통화에 사용해요."
          />
          <Row
            icon={<Mic color={dark.accent} size={20} strokeWidth={1.75} />}
            title="마이크"
            body="스피드데이트 통화 중, 음성을 전송할 때만 사용해요."
          />
        </DoodleCard>

        {blocked ? (
          <InlineNotice tone="error" dark>
            권한이 거부되어 있어요. 설정에서 카메라·마이크를 허용한 뒤 다시 시도해 주세요.
          </InlineNotice>
        ) : missing ? (
          <InlineNotice tone="error" dark>
            {missing}
          </InlineNotice>
        ) : null}

        <Text style={styles.note}>권한은 소개팅을 시작할 때만 필요하며, 설정에서 언제든 변경할 수 있어요.</Text>
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
    borderColor: dark.border,
    backgroundColor: dark.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { ...type.label, color: dark.text },
  rowBody: { ...type.caption, color: dark.textMuted },
  note: { ...type.caption, color: dark.textMuted, textAlign: "center" },
});
