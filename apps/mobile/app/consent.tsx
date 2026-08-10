import { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { router } from "expo-router";
import { Check } from "lucide-react-native";
import { submitConsents, type ConsentScope } from "@mingle/client-core";
import { AppScreen } from "../src/components/AppScreen";
import { DoodleButton } from "../src/components/Doodle";
import { InlineNotice } from "../src/components/Foundation";
import { dark, doodle, space, type } from "../src/lib/theme";
import {
  LEGAL_UPDATED_AT,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
  type LegalSection,
} from "../src/lib/legal-content";
import {
  hasReachedConsentEnd,
  type ConsentScrollMetrics,
} from "../src/lib/consent-scroll";

// 만 19세 확인은 체크박스가 아니라 본인인증(생년월일)이 보장한다 — age19 항목 없음(2026-07-27).
const ITEMS: {
  scope: ConsentScope;
  title: string;
  agreementLabel: string;
  sections: LegalSection[];
}[] = [
  {
    scope: "terms",
    title: "서비스 이용약관",
    agreementLabel: "서비스 이용약관에 동의합니다.",
    sections: TERMS_SECTIONS,
  },
  {
    scope: "privacy",
    title: "개인정보 수집·이용",
    agreementLabel: "개인정보 수집·이용에 동의합니다.",
    sections: PRIVACY_SECTIONS,
  },
];

export default function Consent() {
  const { height: windowHeight } = useWindowDimensions();
  const [checked, setChecked] = useState<Record<ConsentScope, boolean>>({
    age19: true, // legacy scope — 본인인증이 나이를 보장하므로 UI에 없음
    terms: false,
    privacy: false,
  });
  const [readToEnd, setReadToEnd] = useState<Record<ConsentScope, boolean>>({
    age19: true,
    terms: false,
    privacy: false,
  });
  const scrollMetrics = useRef<Record<ConsentScope, ConsentScrollMetrics>>({
    age19: { layoutHeight: 0, contentHeight: 0, offsetY: 0 },
    terms: { layoutHeight: 0, contentHeight: 0, offsetY: 0 },
    privacy: { layoutHeight: 0, contentHeight: 0, offsetY: 0 },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = ITEMS.every((i) => checked[i.scope]);
  // Give each native ScrollView an explicit viewport. Two flex-sized ScrollViews in one React
  // Native Fabric screen can lose their Android clipping bounds after repeated overscroll.
  const documentHeight = Math.max(88, Math.min(210, (windowHeight - 420) / 2));

  function updateScrollMetrics(scope: ConsentScope, patch: Partial<ConsentScrollMetrics>) {
    const next = { ...scrollMetrics.current[scope], ...patch };
    scrollMetrics.current[scope] = next;
    if (hasReachedConsentEnd(next)) {
      setReadToEnd((current) =>
        current[scope] ? current : { ...current, [scope]: true },
      );
    }
  }

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
      body="plain"
      header={{
        title: "시작 전 동의가 필요해요",
        description: "각 내용을 스크롤해 확인한 뒤 항목별로 동의해 주세요.",
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
        {ITEMS.map((item) => {
          const on = checked[item.scope];
          const canAgree = readToEnd[item.scope];
          return (
            <View key={item.scope} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text accessibilityRole="header" style={styles.cardTitle}>
                    {item.title}
                  </Text>
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredText}>필수</Text>
                  </View>
                </View>
                <Text style={styles.updatedAt}>시행일 {LEGAL_UPDATED_AT}</Text>
              </View>

              <View style={[styles.documentFrame, { height: documentHeight }]}>
                <ScrollView
                  style={styles.document}
                  contentContainerStyle={styles.documentContent}
                  nestedScrollEnabled
                  persistentScrollbar
                  showsVerticalScrollIndicator
                  accessibilityLabel={`${item.title} 전문`}
                  accessibilityHint="위아래로 스크롤해 전체 내용을 확인할 수 있습니다."
                  onLayout={(event: LayoutChangeEvent) =>
                    updateScrollMetrics(item.scope, {
                      layoutHeight: event.nativeEvent.layout.height,
                    })
                  }
                  onContentSizeChange={(_width, height) =>
                    updateScrollMetrics(item.scope, { contentHeight: height })
                  }
                  onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
                    updateScrollMetrics(item.scope, {
                      offsetY: event.nativeEvent.contentOffset.y,
                    })
                  }
                  scrollEventThrottle={16}
                >
                  {item.sections.map((section) => (
                    <View key={section.title} style={styles.section}>
                      <Text accessibilityRole="header" style={styles.sectionTitle}>
                        {section.title}
                      </Text>
                      {section.paragraphs.map((paragraph) => (
                        <Text key={paragraph} style={styles.sectionBody}>
                          {paragraph}
                        </Text>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              </View>

              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={item.agreementLabel}
                accessibilityHint={
                  canAgree ? "두 번 탭해 동의 상태를 바꿉니다." : "약관을 끝까지 읽으면 활성화됩니다."
                }
                accessibilityState={{ checked: on, disabled: !canAgree }}
                disabled={!canAgree}
                onPress={() => setChecked((c) => ({ ...c, [item.scope]: !c[item.scope] }))}
                style={({ pressed }) => [
                  styles.agreeRow,
                  !canAgree && styles.agreeRowDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.box, on && styles.boxOn]}>
                  {on ? <Check color={dark.onPill} size={16} strokeWidth={1.75} /> : null}
                </View>
                <View style={styles.agreeTextGroup}>
                  <Text style={styles.agreeText}>{item.agreementLabel}</Text>
                  <Text
                    style={[styles.readStatus, canAgree && styles.readStatusDone]}
                    accessibilityLiveRegion="polite"
                  >
                    {canAgree ? "내용 확인 완료" : "끝까지 읽으면 동의할 수 있어요"}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}

        {error ? <InlineNotice tone="error" dark>{error}</InlineNotice> : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0, gap: space.x3, paddingTop: space.x2 },
  card: {
    overflow: "hidden",
    backgroundColor: dark.surface,
    borderWidth: 1.5,
    borderColor: dark.border,
    ...doodle.radius.card,
  },
  cardHeader: {
    zIndex: 2,
    gap: 2,
    paddingHorizontal: space.x4,
    paddingTop: space.x3,
    paddingBottom: space.x2,
    borderBottomWidth: 1,
    borderBottomColor: dark.line,
    backgroundColor: dark.surface,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  cardTitle: { ...type.label, color: dark.text, flexShrink: 1 },
  requiredBadge: {
    borderRadius: 999,
    paddingHorizontal: space.x2,
    paddingVertical: 2,
    backgroundColor: dark.fieldBg,
    borderWidth: 1,
    borderColor: dark.border,
  },
  requiredText: { ...type.caption, fontSize: 11, lineHeight: 15, color: dark.accent },
  updatedAt: { ...type.caption, fontSize: 11, lineHeight: 15, color: dark.textMuted },
  documentFrame: {
    overflow: "hidden",
    backgroundColor: "rgba(10,7,5,0.18)",
  },
  document: { flex: 1, minHeight: 0 },
  documentContent: { paddingHorizontal: space.x4, paddingVertical: space.x3, gap: space.x4 },
  section: { gap: space.x2 },
  sectionTitle: { ...type.label, fontSize: 14, lineHeight: 20, color: dark.heading },
  sectionBody: { ...type.caption, color: dark.text, lineHeight: 20 },
  agreeRow: {
    zIndex: 2,
    flexDirection: "row",
    gap: space.x3,
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: space.x4,
    paddingVertical: space.x3,
    borderTopWidth: 1,
    borderTopColor: dark.line,
    backgroundColor: dark.surface,
  },
  agreeRowDisabled: { opacity: 0.58 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: dark.border,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: dark.pill, borderColor: dark.pill },
  agreeTextGroup: { flex: 1, gap: 2 },
  agreeText: { ...type.label, color: dark.text },
  readStatus: { ...type.caption, fontSize: 11, lineHeight: 15, color: dark.textMuted },
  readStatusDone: { color: dark.success },
  pressed: { opacity: 0.72 },
});
