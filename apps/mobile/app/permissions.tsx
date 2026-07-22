import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Linking } from "react-native";
import { router } from "expo-router";
import { Camera, Mic } from "lucide-react-native";
import { DoodleButton, DoodleCard } from "../src/components/Doodle";
import { ContentColumn, InlineNotice } from "../src/components/Foundation";
import { requestCameraMic, isPermanentlyDenied } from "../src/lib/permissions";
import { colors, layout, space, type } from "../src/lib/theme";

export default function Permissions() {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function onRequest() {
    setBusy(true);
    const state = await requestCameraMic();
    if (state.camera && state.microphone) {
      router.replace("/home");
      return;
    }
    setBlocked(await isPermanentlyDenied());
    setBusy(false);
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ContentColumn style={styles.container}>
        <Text accessibilityRole="header" style={styles.title}>카메라·마이크 권한이 필요해요</Text>
        <Text style={styles.sub}>
          영상 대화(블라인드 데이트)를 위해 카메라와 마이크 권한이 필요해요. 두 가지를 모두 허용해야
          서비스를 이용할 수 있어요.
        </Text>

        <DoodleCard tone="fill" contentStyle={styles.card}>
          <Row icon={<Camera color={colors.ink} size={20} />} title="카메라" body="얼굴 공개 단계의 영상 통화에 사용해요." />
          <Row icon={<Mic color={colors.ink} size={20} />} title="마이크" body="모든 대화의 음성에 사용해요." />
        </DoodleCard>

        {blocked ? (
          <>
            <InlineNotice tone="error">
              권한이 거부되어 있어요. 설정에서 카메라·마이크를 허용한 뒤 다시 시도해 주세요.
            </InlineNotice>
            <DoodleButton title="설정 열기" onPress={() => Linking.openSettings()} variant="primary" />
            <DoodleButton title="다시 확인" onPress={onRequest} />
          </>
        ) : (
          <DoodleButton
            title={busy ? "요청 중…" : "권한 허용하기"}
            onPress={onRequest}
            disabled={busy}
            variant="primary"
          />
        )}
        <Text style={styles.note}>권한 없이는 서비스를 이용할 수 없어요.</Text>
      </ContentColumn>
    </ScrollView>
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
  scroll: { flexGrow: 1, justifyContent: "center", padding: layout.screenGutter, backgroundColor: colors.paper },
  container: { gap: space.x4, paddingVertical: space.x6 },
  title: { ...type.title, color: colors.ink, textAlign: "center" },
  sub: { ...type.body, color: colors.grayDark, textAlign: "center" },
  card: { gap: space.x3 },
  row: { flexDirection: "row", gap: space.x3, alignItems: "center" },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { ...type.label, color: colors.ink },
  rowBody: { ...type.caption, color: colors.grayDark },
  note: { ...type.caption, color: colors.grayDark, textAlign: "center" },
});
