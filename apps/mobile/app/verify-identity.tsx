import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import {
  startIdentityVerification,
  completeIdentityVerification,
  completeProviderIdentityVerification,
  ApiError,
  type IdentityVerificationStart,
} from "@mingle/client-core";
import { IdentityVerification } from "@portone/react-native-sdk";
import type { IdentityVerificationResponse } from "@portone/browser-sdk/v2";
import { DoodleButton } from "../src/components/Doodle";
import { AppScreen } from "../src/components/AppScreen";
import { InlineNotice, LabeledInput, StateView } from "../src/components/Foundation";
import { dark, space, type } from "../src/lib/theme";
import { resolveIdentityVerificationMode } from "../src/lib/identity-verification-mode";

type Mode = "loading" | "dev" | "portone" | "unavailable";

export default function VerifyIdentity() {
  const [mode, setMode] = useState<Mode>("loading");
  const [providerRequest, setProviderRequest] = useState<
    Extract<IdentityVerificationStart, { mode: "portone" }> | null
  >(null);
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
        if (r.mode === "portone") setProviderRequest(r);
        setMode(resolveIdentityVerificationMode(r.mode, __DEV__));
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

  async function onProviderComplete(response: IdentityVerificationResponse) {
    if (!providerRequest) return;
    if (response.code) {
      setError(response.message ?? "본인인증을 완료하지 못했어요.");
      return;
    }
    if (response.identityVerificationId !== providerRequest.identityVerificationId) {
      setError("인증 요청 정보가 일치하지 않아요. 다시 시도해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await completeProviderIdentityVerification(response.identityVerificationId);
      router.replace("/home");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "인증 결과를 확인하지 못했어요.");
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

  if (mode === "portone" && providerRequest) {
    return (
      <AppScreen
        body="plain"
        tone="dark"
        header={{
          title: "본인인증",
          description: "인증 정보는 안전한 가입과 중복 계정 방지에만 사용해요.",
        }}
      >
        {busy ? (
          <View style={styles.providerLoading}>
            <ActivityIndicator color={dark.accent} />
            <Text style={styles.providerLoadingText}>인증 결과를 안전하게 확인하고 있어요</Text>
          </View>
        ) : (
          <>
            <IdentityVerification
              style={styles.provider}
              request={{
                storeId: providerRequest.storeId as `store-${string}`,
                channelKey: providerRequest.channelKey as `channel-key-${string}`,
                identityVerificationId: providerRequest.identityVerificationId,
              }}
              onComplete={(response) => void onProviderComplete(response)}
              onError={(e) => setError(e.message || "본인인증 창을 열지 못했어요.")}
            />
            {error ? (
              <View style={styles.providerError}>
                <InlineNotice tone="error" dark>{error}</InlineNotice>
              </View>
            ) : null}
          </>
        )}
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
  provider: { flex: 1, minHeight: 480 },
  providerLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.x3 },
  providerLoadingText: { ...type.body, color: dark.textMuted },
  providerError: { position: "absolute", left: space.x4, right: space.x4, bottom: space.x4 },
});
