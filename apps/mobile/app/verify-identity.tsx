import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import {
  startIdentityVerification,
  completeIdentityVerification,
  ApiError,
} from "@mingle/client-core";
import { DoodleButton } from "../src/components/Doodle";
import { AppScreen } from "../src/components/AppScreen";
import { InlineNotice, LabeledInput, StateView } from "../src/components/Foundation";
import { dark, space, type } from "../src/lib/theme";

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
      .then((r) => {
        if (!alive) return;
        setMode(r.mode === "dev" && __DEV__ ? "dev" : "unavailable");
      })
      .catch(() => alive && setMode("unavailable"));
    return () => {
      alive = false;
    };
  }, []);

  const valid = name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(birth) && gender && /^[0-9]{9,11}$/.test(phone);

  async function onSubmit() {
    // Defense in depth: a production bundle must never call the developer-only completion API,
    // even if a stale or misconfigured backend responds with mode="dev".
    if (!__DEV__ || !gender) return;
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
      <AppScreen body="plain" tone="dark">
        <View style={styles.loading}>
          <ActivityIndicator color={dark.accent} />
        </View>
      </AppScreen>
    );
  }

  if (mode === "unavailable") {
    return (
      <AppScreen body="plain" tone="dark">
        <StateView
          title="본인인증 준비 중"
          body="실명 본인인증(통신사·인증기관) 연동을 준비하고 있어요. 잠시 후 다시 시도해 주세요."
          actionLabel="다시 시도"
          onAction={() => setMode("loading")}
          dark
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      tone="dark"
      keyboardAware
      header={{
        title: "본인인증",
        description: "안전한 매칭을 위해 실명 본인인증이 필요해요. (개발용 입력)",
      }}
      footer={
        <DoodleButton
          title="인증 완료"
          onPress={onSubmit}
          disabled={!valid}
          busy={busy}
          variant="primary"
          tone="dark"
        />
      }
    >
      <View style={styles.form}>
        <LabeledInput label="이름" placeholder="홍길동" value={name} onChangeText={setName} dark />
        <LabeledInput
          label="생년월일 (YYYY-MM-DD)"
          placeholder="1996-05-02"
          value={birth}
          onChangeText={setBirth}
          keyboardType="numbers-and-punctuation"
          dark
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
          dark
        />

        {error ? (
          <InlineNotice tone="error" dark>
            {error}
          </InlineNotice>
        ) : null}

        <Text style={styles.note}>인증된 이름·성별·생년월일은 프로필에 반영돼요.</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  form: { gap: space.x4, paddingTop: space.x2 },
  fieldLabel: { ...type.label, color: dark.text, marginBottom: space.x2 },
  genderRow: { flexDirection: "row", gap: space.x3 },
  genderChip: {
    flex: 1,
    paddingVertical: space.x3,
    borderWidth: 1.5,
    borderColor: dark.border,
    borderRadius: 10,
    alignItems: "center",
  },
  genderChipOn: { backgroundColor: dark.pill, borderColor: dark.pill },
  genderText: { ...type.label, color: dark.textMuted },
  genderTextOn: { color: dark.onPill },
  note: { ...type.caption, color: dark.textMuted, textAlign: "center" },
});
