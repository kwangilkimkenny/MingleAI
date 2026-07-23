import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { Check } from "lucide-react-native";
import { submitConsents, type ConsentScope } from "@mingle/client-core";
import { DoodleButton } from "../src/components/Doodle";
import { ContentColumn, InlineNotice } from "../src/components/Foundation";
import { colors, layout, space, type } from "../src/lib/theme";

const ITEMS: { scope: ConsentScope; title: string; body: string; link?: "/terms" | "/privacy" }[] = [
  { scope: "age19", title: "만 19세 이상입니다", body: "성인만 이용할 수 있는 서비스예요." },
  { scope: "terms", title: "이용약관 동의 (필수)", body: "서비스 이용을 위한 약관이에요.", link: "/terms" },
  {
    scope: "privacy",
    title: "개인정보 수집·이용 동의 (필수)",
    body: "매칭·안전을 위해 프로필과 본인인증 정보를 수집해요.",
    link: "/privacy",
  },
];

export default function Consent() {
  const [checked, setChecked] = useState<Record<ConsentScope, boolean>>({
    age19: false,
    terms: false,
    privacy: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = ITEMS.every((i) => checked[i.scope]);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await submitConsents(ITEMS.map((i) => i.scope));
      router.replace("/home");
    } catch {
      setError("동의 저장에 실패했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ContentColumn style={styles.container}>
        <Text accessibilityRole="header" style={styles.title}>시작 전 동의가 필요해요</Text>
        <Text style={styles.sub}>안전한 서비스 운영을 위해 아래 항목에 모두 동의해 주세요.</Text>

        {ITEMS.map((item) => {
          const on = checked[item.scope];
          return (
            <Pressable
              key={item.scope}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => setChecked((c) => ({ ...c, [item.scope]: !c[item.scope] }))}
              style={styles.row}
            >
              <View style={[styles.box, on && styles.boxOn]}>
                {on ? <Check color={colors.onAccent} size={16} strokeWidth={3} /> : null}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowBody}>{item.body}</Text>
                {item.link ? (
                  <Text
                    style={styles.link}
                    onPress={() => router.push(item.link!)}
                    accessibilityRole="link"
                  >
                    전문 보기
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}

        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

        <DoodleButton
          title={busy ? "저장 중…" : "동의하고 계속"}
          onPress={onSubmit}
          disabled={!allChecked || busy}
          variant="primary"
        />
        <Text style={styles.note}>모든 필수 항목에 동의해야 서비스를 이용할 수 있어요.</Text>
      </ContentColumn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", padding: layout.screenGutter, backgroundColor: colors.paper },
  container: { gap: space.x4, paddingVertical: space.x6 },
  title: { ...type.title, color: colors.heading, textAlign: "center" },
  sub: { ...type.body, color: colors.grayDark, textAlign: "center" },
  row: { flexDirection: "row", gap: space.x3, alignItems: "flex-start" },
  box: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.label, color: colors.ink },
  rowBody: { ...type.caption, color: colors.grayDark },
  link: { ...type.caption, color: colors.accent, textDecorationLine: "underline", marginTop: 4 },
  note: { ...type.caption, color: colors.grayDark, textAlign: "center" },
});
