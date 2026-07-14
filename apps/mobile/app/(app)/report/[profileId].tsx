import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  reportUser,
  createBlock,
  REPORT_REASONS,
  ApiError,
  type ReportReason,
} from "@mingle/client-core";
import { REASON_LABELS } from "../../../src/lib/moderation";
import { BackButton } from "../../../src/components/BackButton";
import { doodleInputStyle } from "../../../src/components/Doodle";
import { DoodleChip } from "../../../src/components/DoodleSvg";
import { colors, fonts } from "../../../src/lib/theme";

const MAX_DETAILS = 1000;

export default function ReportScreen() {
  const { profileId, evidencePartyId } = useLocalSearchParams<{
    profileId: string;
    evidencePartyId?: string;
  }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      await reportUser({
        reportedProfileId: profileId,
        reason,
        details: details.trim() || undefined,
        evidencePartyId: evidencePartyId || undefined,
      });
      Alert.alert("신고가 접수되었습니다", "이 사용자를 차단할까요?", [
        { text: "아니요", style: "cancel", onPress: () => router.back() },
        {
          text: "이 사용자도 차단",
          style: "destructive",
          onPress: async () => {
            try {
              await createBlock(profileId);
            } catch {
              // block failure is non-fatal to the already-submitted report
            }
            router.back();
          },
        },
      ]);
    } catch (e) {
      setSubmitting(false);
      Alert.alert("신고 실패", e instanceof ApiError ? e.message : "신고를 접수하지 못했어요");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <BackButton />
      <Text style={styles.title}>신고하기</Text>

      <Text style={styles.section}>신고 사유</Text>
      <View style={styles.reasonWrap}>
        {REPORT_REASONS.map((r) => (
          <DoodleChip
            key={r}
            label={REASON_LABELS[r]}
            on={reason === r}
            onPress={() => setReason(r)}
          />
        ))}
      </View>

      <Text style={styles.section}>상세 내용 (선택)</Text>
      <TextInput
        style={styles.input}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={MAX_DETAILS}
        placeholder="자세한 상황을 적어주세요"
        placeholderTextColor={colors.grayMid}
      />
      <Text style={styles.counter}>
        {details.length}/{MAX_DETAILS}
      </Text>

      <Pressable
        style={[styles.submit, (!reason || submitting) && styles.submitDisabled]}
        disabled={!reason || submitting}
        onPress={onSubmit}
      >
        {submitting ? (
          <ActivityIndicator color={colors.paper} />
        ) : (
          <Text style={styles.submitText}>신고 제출</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, marginBottom: 4 },
  section: { fontSize: 13, fontWeight: "700", color: colors.grayMid, marginTop: 10 },
  reasonWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  input: { ...doodleInputStyle, minHeight: 96, textAlignVertical: "top" },
  counter: { alignSelf: "flex-end", fontSize: 12, color: colors.grayMid },
  submit: {
    marginTop: 12,
    backgroundColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitDisabled: { backgroundColor: colors.grayLight },
  submitText: { color: colors.paper, fontWeight: "700", fontSize: 15 },
});
