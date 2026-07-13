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

const INK = "#17150F";
const PAPER = "#FFFFFF";
const GRAY_MED = "#8A857C";
const GRAY_LIGHT = "#D9D5CC";
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
      {REPORT_REASONS.map((r) => {
        const selected = reason === r;
        return (
          <Pressable key={r} style={styles.reasonRow} onPress={() => setReason(r)}>
            <View style={[styles.radio, selected && styles.radioOn]}>
              {selected ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={styles.reasonText}>{REASON_LABELS[r]}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.section}>상세 내용 (선택)</Text>
      <TextInput
        style={styles.input}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={MAX_DETAILS}
        placeholder="자세한 상황을 적어주세요"
        placeholderTextColor={GRAY_MED}
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
          <ActivityIndicator color={PAPER} />
        ) : (
          <Text style={styles.submitText}>신고 제출</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  content: { padding: 20, gap: 10 },
  title: { fontSize: 20, fontWeight: "700", color: INK, marginBottom: 4 },
  section: { fontSize: 13, fontWeight: "700", color: GRAY_MED, marginTop: 10 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: GRAY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: INK },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: INK },
  reasonText: { fontSize: 15, color: INK },
  input: {
    borderWidth: 2,
    borderColor: GRAY_LIGHT,
    borderRadius: 8,
    padding: 12,
    minHeight: 96,
    color: INK,
    textAlignVertical: "top",
  },
  counter: { alignSelf: "flex-end", fontSize: 12, color: GRAY_MED },
  submit: {
    marginTop: 12,
    backgroundColor: INK,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitDisabled: { backgroundColor: GRAY_LIGHT },
  submitText: { color: PAPER, fontWeight: "700", fontSize: 15 },
});
