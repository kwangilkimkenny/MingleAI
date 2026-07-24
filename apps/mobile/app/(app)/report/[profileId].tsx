import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  reportUser,
  createBlock,
  REPORT_REASONS,
  ApiError,
  type ReportReason,
} from "@mingle/client-core";
import { REASON_LABELS } from "../../../src/lib/moderation";
import { DoodleButton } from "../../../src/components/Doodle";
import { DoodleChip } from "../../../src/components/DoodleSvg";
import { AppScreen } from "../../../src/components/AppScreen";
import { colors, dark, space, type } from "../../../src/lib/theme";
import { ConfirmDialog, InlineNotice, LabeledInput } from "../../../src/components/Foundation";
import { CheckCircle2, Shield } from "lucide-react-native";

const MAX_DETAILS = 1000;

export default function ReportScreen() {
  const { profileId, evidencePartyId } = useLocalSearchParams<{
    profileId: string;
    evidencePartyId?: string;
  }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function closeScreen() {
    if (router.canGoBack()) router.back();
    else router.replace("/home");
  }

  async function onSubmit() {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await reportUser({
        reportedProfileId: profileId,
        reason,
        details: details.trim() || undefined,
        evidencePartyId: evidencePartyId || undefined,
      });
      setSubmitted(true);
    } catch (e) {
      setSubmitting(false);
      setError(e instanceof ApiError ? e.message : "신고를 접수하지 못했어요.");
    }
  }

  async function onBlock() {
    setBlocking(true);
    try {
      await createBlock(profileId);
      setBlockOpen(false);
      closeScreen();
    } catch (e) {
      setBlockOpen(false);
      setError(e instanceof ApiError ? e.message : "차단하지 못했어요.");
    } finally {
      setBlocking(false);
    }
  }

  if (submitted) {
    return (
      <AppScreen tone="dark" contentStyle={styles.successScroll}>
        <View style={styles.successInner}>
          <CheckCircle2 color={colors.success} size={58} strokeWidth={1.75} />
          <Text accessibilityRole="header" style={styles.successTitle}>
            신고가 접수됐어요
          </Text>
          <Text style={styles.successBody}>
            검토에 필요한 내용을 안전하게 전달했어요. 상대에게 신고 사실이나 상세 내용은 공개되지 않아요.
          </Text>
          {error ? (
            <InlineNotice tone="error" dark>
              {error}
            </InlineNotice>
          ) : null}
          <DoodleButton
            title="이 사용자도 차단"
            variant="danger"
            tone="dark"
            onPress={() => setBlockOpen(true)}
          />
          <DoodleButton title="완료" tone="dark" onPress={closeScreen} />
        </View>
        <ConfirmDialog
          visible={blockOpen}
          title="이 사용자도 차단할까요?"
          body="서로의 프로필과 대화가 보이지 않게 됩니다. 설정에서 나중에 해제할 수 있어요."
          confirmLabel="차단하기"
          destructive
          busy={blocking}
          onCancel={() => setBlockOpen(false)}
          onConfirm={onBlock}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      tone="dark"
      header={{ back: true, title: "신고" }}
      footer={
        <DoodleButton
          title={submitting ? "신고 제출 중..." : "신고 제출"}
          variant="danger"
          tone="dark"
          disabled={!reason || submitting}
          onPress={onSubmit}
        />
      }
    >
      <View style={styles.form}>
        <Text style={styles.section}>신고 사유</Text>
        <View style={styles.reasonWrap} accessibilityRole="radiogroup">
          {REPORT_REASONS.map((r) => (
            <DoodleChip
              key={r}
              label={REASON_LABELS[r]}
              on={reason === r}
              dark
              onPress={() => setReason(r)}
            />
          ))}
        </View>

        <LabeledInput
          label="상세 내용 (선택)"
          value={details}
          onChangeText={setDetails}
          multiline
          dark
          maxLength={MAX_DETAILS}
          placeholder="자세한 상황을 적어주세요"
          hint="시간, 장소, 상대의 행동처럼 사실을 중심으로 적어주면 검토에 도움이 돼요."
        />
        <Text style={styles.counter}>
          {details.length}/{MAX_DETAILS}
        </Text>

        {error ? (
          <InlineNotice tone="error" dark>
            {error}
          </InlineNotice>
        ) : null}
        <View style={styles.safetyNote}>
          <Shield color={colors.success} size={19} strokeWidth={1.75} />
          <Text style={styles.safetyNoteText}>제출 후 바로 차단할지 선택할 수 있어요.</Text>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.x4 },
  section: { ...type.label, color: dark.text },
  reasonWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.x2 },
  counter: { alignSelf: "flex-end", ...type.caption, color: dark.textMuted },
  safetyNote: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  safetyNoteText: { ...type.caption, color: dark.textMuted, flex: 1 },
  successScroll: { flexGrow: 1, justifyContent: "center" },
  successInner: { alignItems: "center", gap: space.x4 },
  successTitle: { ...type.title, color: dark.heading, textAlign: "center" },
  successBody: { ...type.body, color: dark.textMuted, textAlign: "center", maxWidth: 420 },
});
