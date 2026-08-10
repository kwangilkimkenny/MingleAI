import { dark, space, type } from "../src/lib/theme";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Redirect, router } from "expo-router";
import { createProfile, getMyProfile, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";
import { useAuthHydrated } from "../src/lib/use-hydrated";
import { AppScreen } from "../src/components/AppScreen";
import { DoodleButton } from "../src/components/Doodle";
import { DoodleAvatar } from "../src/components/DoodleAvatar";
import { pickAndUploadPhoto } from "../src/lib/photo";
import { InlineNotice, LabeledInput, StateView } from "../src/components/Foundation";
import {
  PreferencePicker,
  EMPTY_ANSWERS,
  answersComplete,
  type PreferenceAnswers,
} from "../src/components/PreferencePicker";

// 성별·나이는 본인인증(verified) 값이 권위 — 온보딩에서 다시 묻지 않는다(2026-07-27).
// 선호는 자유서술 대신 구조화 선택(2026-08-06) — 활동 1개 이상이면 유효.
function validate(fields: {
  name: string;
  occupation: string;
  answers: PreferenceAnswers;
}): string | null {
  if (!fields.name.trim()) return "닉네임을 입력해 주세요.";
  if (fields.name.trim().length > 40) return "닉네임은 40자 이하로 입력해 주세요.";
  if (!fields.occupation.trim()) return "직업을 입력해 주세요.";
  if (!answersComplete(fields.answers)) return "같이 하고 싶은 것을 하나 이상 골라 주세요.";
  return null;
}

export default function Onboarding() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);

  const [name, setName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [answers, setAnswers] = useState<PreferenceAnswers>(EMPTY_ANSWERS);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [profileChecked, setProfileChecked] = useState<"loading" | "none" | "has">("loading");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (!hydrated || !token) return;
    let alive = true;
    getMyProfile()
      .then((p) => {
        if (alive) setProfileChecked(p ? "has" : "none");
      })
      .catch(() => {
        if (alive) setProfileChecked("none");
      });
    return () => {
      alive = false;
    };
  }, [hydrated, token]);

  if (!hydrated) return <StateView title="계정을 확인하고 있어요" loading dark />;
  if (!token) return <Redirect href="/login" />;
  if (profileChecked === "loading") return <StateView title="프로필을 확인하고 있어요" loading dark />;
  if (profileChecked === "has") return <Redirect href="/home" />;

  async function onPickPhoto() {
    if (photoBusy) return;
    setPhotoError(null);
    setPhotoBusy(true);
    const res = await pickAndUploadPhoto();
    setPhotoBusy(false);
    if (res.status === "ok") setPhotoUrl(res.url);
    else if (res.status === "denied")
      setPhotoError("사진을 추가하려면 기기 설정에서 사진 접근을 허용해 주세요.");
    else if (res.status === "error") setPhotoError(res.message);
  }

  async function onSubmit() {
    if (busy) return;
    setSubmitError(null);
    setBusy(true);
    try {
      const profile = await createProfile({
        name: name.trim(),
        occupation: occupation.trim(),
        preferences: { ...answers, note: answers.note?.trim() || undefined },
        ...(photoUrl ? { photoUrl } : {}),
      });
      if (!profile.preferenceSignals) {
        router.replace({ pathname: "/home", params: { notice: "선호 분석은 곧 반영돼요." } });
      } else {
        router.replace("/home");
      }
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "프로필 저장에 실패했어요.");
      setBusy(false);
    }
  }

  const valid = !validate({ name, occupation, answers });
  const stepValid =
    step === 1
      ? Boolean(name.trim()) && name.trim().length <= 40 && Boolean(occupation.trim())
      : step === 2
        ? answersComplete(answers)
        : valid;

  const footer = (
    <View style={styles.footerRow}>
      {step > 1 ? (
        <View style={styles.footerSecondary}>
          <DoodleButton
            title="이전"
            onPress={() => setStep((step - 1) as 1 | 2)}
            tone="dark"
            disabled={busy}
          />
        </View>
      ) : null}
      <View style={styles.footerPrimary}>
        <DoodleButton
          title={step === 3 ? "프로필 완성" : "다음"}
          onPress={step === 3 ? onSubmit : () => setStep((step + 1) as 2 | 3)}
          variant="primary"
          tone="dark"
          disabled={!stepValid || busy}
          busy={busy}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppScreen
        tone="dark"
        body="scroll"
        header={{
          title: step === 1 ? "기본 프로필" : step === 2 ? "취향과 템포" : "마지막 확인",
          description: `${step}/3 · ${step === 1 ? "상대에게 보일 정보를 입력해요" : step === 2 ? "더 잘 맞는 대화를 찾아드려요" : "이 모습으로 밍글을 시작해요"}`,
        }}
        footer={footer}
      >
        <View style={styles.form}>
          <View style={styles.progressTrack} accessibilityLabel={`프로필 작성 ${step}/3 단계`}>
            <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
          </View>

          {step === 1 ? <>
            <View style={styles.photoSection}>
            <TouchableOpacity
              onPress={onPickPhoto}
              disabled={photoBusy}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="프로필 사진 선택"
            >
              <DoodleAvatar uri={photoUrl} name={name} size={84} />
              {photoBusy ? (
                <View style={styles.photoBusy}>
                  <ActivityIndicator color={dark.text} />
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onPickPhoto}
              disabled={photoBusy}
              accessibilityRole="button"
              accessibilityLabel={photoUrl ? "프로필 사진 변경" : "프로필 사진 추가"}
              style={styles.photoLinkButton}
            >
              <Text style={styles.photoLink}>{photoUrl ? "사진 변경" : "사진 추가 (선택)"}</Text>
            </TouchableOpacity>
            {photoError ? (
              <View style={styles.photoNotice}>
                <InlineNotice tone="error" dark>
                  {photoError}
                </InlineNotice>
              </View>
            ) : null}
            </View>

          <LabeledInput
            label="닉네임 / 이름"
            placeholder="표시될 이름"
            hint="다른 사용자에게 공개되는 이름이에요."
            value={name}
            onChangeText={setName}
            maxLength={40}
            dark
          />

          <LabeledInput
            label="직업"
            placeholder="예: 대학원생"
            maxLength={120}
            value={occupation}
            onChangeText={setOccupation}
            dark
          />

          </> : null}

          {step === 2 ? <PreferencePicker value={answers} onChange={setAnswers} /> : null}

          {step === 3 ? (
            <View style={styles.previewCard}>
              <DoodleAvatar uri={photoUrl} name={name} size={76} />
              <View style={styles.previewText}>
                <Text style={styles.previewName}>{name.trim()}</Text>
                <Text style={styles.previewOccupation}>{occupation.trim()}</Text>
              </View>
              <View style={styles.previewDivider} />
              <Text style={styles.previewLabel}>매칭 프로필 준비 완료</Text>
              <Text style={styles.previewBody}>
                선택한 대화 분위기와 활동 취향을 바탕으로 상대를 찾아드려요. 이름과 사진은 얼굴 공개 전까지 숨겨져요.
              </Text>
            </View>
          ) : null}

          {submitError ? (
            <InlineNotice tone="error" dark>
              {submitError}
            </InlineNotice>
          ) : null}
        </View>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: space.x4, marginTop: space.x4 },
  footerRow: { flexDirection: "row", gap: space.x2 },
  footerSecondary: { flex: 0.38 },
  footerPrimary: { flex: 1 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: dark.fieldBg },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: dark.accent },
  photoSection: { alignItems: "center", gap: space.x2, marginBottom: space.x1 },
  photoBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(26,18,12,0.55)",
    borderRadius: 52,
  },
  photoLink: {
    ...type.label,
    color: dark.text,
    textDecorationLine: "underline",
  },
  photoLinkButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  photoNotice: { alignSelf: "stretch", marginTop: space.x1 },
  previewCard: {
    alignItems: "center",
    padding: space.x5,
    gap: space.x2,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
  },
  previewText: { alignItems: "center" },
  previewName: { ...type.title, color: dark.text },
  previewOccupation: { ...type.body, color: dark.textMuted },
  previewDivider: { width: "100%", height: 1, backgroundColor: dark.line, marginVertical: space.x2 },
  previewLabel: { ...type.label, color: dark.successBright },
  previewBody: { ...type.body, color: dark.textMuted, textAlign: "center" },
});
