import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { Check } from "lucide-react-native";
import { submitConsents, type ConsentScope } from "@mingle/client-core";
import { AppScreen } from "../src/components/AppScreen";
import { DoodleButton, DoodleCard } from "../src/components/Doodle";
import { InlineNotice } from "../src/components/Foundation";
import { dark, space, type } from "../src/lib/theme";

// 만 19세 확인은 체크박스가 아니라 본인인증(생년월일)이 보장한다 — age19 항목 없음(2026-07-27).
const ITEMS: { scope: ConsentScope; title: string; body: string; link?: "/terms" | "/privacy" }[] = [
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
    age19: true, // legacy scope — 본인인증이 나이를 보장하므로 UI에 없음
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
    <AppScreen
      tone="dark"
      header={{
        title: "시작 전 동의가 필요해요",
        description: "안전한 서비스 운영을 위해 아래 항목에 모두 동의해 주세요.",
      }}
      footer={
        <DoodleButton
          title={busy ? "저장 중…" : "동의하고 계속"}
          onPress={onSubmit}
          disabled={!allChecked || busy}
          variant="primary"
          tone="dark"
        />
      }
    >
      <View style={styles.body}>
        <DoodleCard tone="dark" contentStyle={styles.cardList}>
          {ITEMS.map((item, i) => {
            const on = checked[item.scope];
            return (
              <Pressable
                key={item.scope}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => setChecked((c) => ({ ...c, [item.scope]: !c[item.scope] }))}
                style={[styles.row, i > 0 && styles.rowDivider]}
              >
                <View style={[styles.box, on && styles.boxOn]}>
                  {on ? <Check color={dark.onPill} size={16} strokeWidth={1.75} /> : null}
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
        </DoodleCard>

        {error ? <InlineNotice tone="error" dark>{error}</InlineNotice> : null}

        <Text style={styles.note}>모든 필수 항목에 동의해야 서비스를 이용할 수 있어요.</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.x4, paddingTop: space.x2 },
  cardList: { padding: 0 },
  row: {
    flexDirection: "row",
    gap: space.x3,
    alignItems: "flex-start",
    paddingHorizontal: space.x4,
    paddingVertical: space.x4,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: dark.line },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: dark.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  boxOn: { backgroundColor: dark.pill, borderColor: dark.pill },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.label, color: dark.text },
  rowBody: { ...type.caption, color: dark.textMuted },
  link: { ...type.caption, color: dark.accent, textDecorationLine: "underline", marginTop: 4 },
  note: { ...type.caption, color: dark.textMuted, textAlign: "center" },
});
