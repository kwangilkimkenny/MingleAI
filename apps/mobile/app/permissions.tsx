import { useState } from "react";
import { View, Text, StyleSheet, Linking } from "react-native";
import { router } from "expo-router";
import { Mic } from "lucide-react-native";
import { AppScreen } from "../src/components/AppScreen";
import { DoodleButton, DoodleCard } from "../src/components/Doodle";
import { InlineNotice } from "../src/components/Foundation";
import { requestMic, isPermanentlyDenied } from "../src/lib/permissions";
import { dark, space, type } from "../src/lib/theme";

/**
 * 세션 진입 직전 프라이밍(2026-07-27). **마이크만** 받는다 — 카메라는 얼굴 공개 단계에서
 * 세션 화면이 따로 요청한다(2026-08-11: 진입부터 카메라를 요구해 첫 두 단계도 못 해보고 이탈).
 */
export default function Permissions() {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [missing, setMissing] = useState<string | null>(null);

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace("/home");
  }

  async function onRequest() {
    setBusy(true);
    setMissing(null);
    try {
      if (await requestMic()) {
        leave();
        return;
      }
      setMissing("마이크 권한이 아직 허용되지 않았어요.");
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
    <View style={styles.footerStack}>
      <DoodleButton
        title={busy ? "요청 중…" : "마이크 허용하기"}
        onPress={onRequest}
        disabled={busy}
        variant="primary"
        tone="dark"
      />
      <DoodleButton title="나중에" onPress={leave} tone="dark" />
    </View>
  );

  return (
    <AppScreen
      header={{ title: "마이크 권한", back: true }}
      footer={footer}
      tone="dark"
    >
      <View style={styles.body}>
        <DoodleCard tone="dark" contentStyle={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Mic color={dark.accent} size={20} strokeWidth={1.75} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>마이크</Text>
              <Text style={styles.rowBody}>대화 중 목소리를 전달할 때만 사용해요.</Text>
            </View>
          </View>
        </DoodleCard>

        {blocked ? (
          <InlineNotice tone="error" dark>
            권한이 거부되어 있어요. 설정에서 마이크를 허용한 뒤 다시 시도해 주세요.
          </InlineNotice>
        ) : missing ? (
          <InlineNotice tone="error" dark>
            {missing}
          </InlineNotice>
        ) : null}

        <Text style={styles.note}>
          카메라는 얼굴 공개 단계로 넘어갈 때 따로 여쭤봐요.
        </Text>
      </View>
    </AppScreen>
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
