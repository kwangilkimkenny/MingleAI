import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import {
  startIdentityVerification,
  completeIdentityVerification,
  ApiError,
} from "@mingle/client-core";
import { DoodleButton } from "../src/components/Doodle";
import { ContentColumn, InlineNotice, LabeledInput } from "../src/components/Foundation";
import { colors, layout, space, type } from "../src/lib/theme";

type Mode = "loading" | "dev" | "unavailable";

export default function VerifyIdentity() {
  const [mode, setMode] = useState<Mode>("loading");
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    startIdentityVerification()
      .then((r) => alive && setMode(r.mode === "dev" ? "dev" : "unavailable"))
      .catch(() => alive && setMode("unavailable"));
    return () => {
      alive = false;
    };
  }, []);

  const valid = name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(birth) && gender && /^[0-9]{9,11}$/.test(phone);

  async function onSubmit() {
    if (!gender) return;
    setBusy(true);
    setError(null);
    try {
      await completeIdentityVerification({ name: name.trim(), birth, gender, phone });
      router.replace("/home");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "본인인증에 실패했어요.");
      setBusy(false);
    }
  }

  if (mode === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (mode === "unavailable") {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <ContentColumn style={styles.container}>
          <Text accessibilityRole="header" style={styles.title}>본인인증 준비 중</Text>
          <Text style={styles.sub}>
            실명 본인인증(통신사·인증기관) 연동을 준비하고 있어요. 잠시 후 다시 시도해 주세요.
          </Text>
          <DoodleButton title="다시 시도" onPress={() => setMode("loading")} variant="primary" />
        </ContentColumn>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <ContentColumn style={styles.container}>
        <Text accessibilityRole="header" style={styles.title}>본인인증</Text>
        <Text style={styles.sub}>안전한 매칭을 위해 실명 본인인증이 필요해요. (개발용 입력)</Text>

        <LabeledInput label="이름" placeholder="홍길동" value={name} onChangeText={setName} />
        <LabeledInput
          label="생년월일 (YYYY-MM-DD)"
          placeholder="1996-05-02"
          value={birth}
          onChangeText={setBirth}
          keyboardType="numbers-and-punctuation"
        />
        <View>
          <Text style={styles.fieldLabel}>성별</Text>
          <View style={styles.genderRow}>
            {(["male", "female"] as const).map((g) => (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                accessibilityRole="radio"
                accessibilityState={{ selected: gender === g }}
                style={[styles.genderChip, gender === g && styles.genderChipOn]}
              >
                <Text style={[styles.genderText, gender === g && styles.genderTextOn]}>
                  {g === "male" ? "남성" : "여성"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <LabeledInput
          label="휴대폰 번호"
          placeholder="01012345678"
          value={phone}
          onChangeText={setPhone}
          keyboardType="number-pad"
        />

        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

        <DoodleButton
          title={busy ? "인증 중…" : "인증 완료"}
          onPress={onSubmit}
          disabled={!valid || busy}
          variant="primary"
        />
        <Text style={styles.note}>인증된 이름·성별·생년월일은 프로필에 반영돼요.</Text>
      </ContentColumn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  scroll: { flexGrow: 1, justifyContent: "center", padding: layout.screenGutter, backgroundColor: colors.paper },
  container: { gap: space.x4, paddingVertical: space.x6 },
  title: { ...type.title, color: colors.ink, textAlign: "center" },
  sub: { ...type.body, color: colors.grayDark, textAlign: "center" },
  fieldLabel: { ...type.label, color: colors.ink, marginBottom: space.x2 },
  genderRow: { flexDirection: "row", gap: space.x3 },
  genderChip: {
    flex: 1,
    paddingVertical: space.x3,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    alignItems: "center",
  },
  genderChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  genderText: { ...type.label, color: colors.ink },
  genderTextOn: { color: colors.paper },
  note: { ...type.caption, color: colors.grayDark, textAlign: "center" },
});
