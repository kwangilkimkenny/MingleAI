import { colors, space, type } from "../src/lib/theme";
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
import { DoodleChip } from "../src/components/DoodleSvg";
import { DoodleAvatar } from "../src/components/DoodleAvatar";
import { pickAndUploadPhoto } from "../src/lib/photo";
import { InlineNotice, LabeledInput, StateView } from "../src/components/Foundation";

const GENDER_OPTIONS = [
  { label: "남성", value: "male" },
  { label: "여성", value: "female" },
  { label: "논바이너리", value: "non_binary" },
  { label: "응답 안 함", value: "prefer_not_to_say" },
] as const;

type Gender = (typeof GENDER_OPTIONS)[number]["value"];

function validate(fields: {
  name: string;
  gender: Gender | null;
  ageText: string;
  occupation: string;
  partyPreferenceText: string;
}): string | null {
  if (!fields.name.trim()) return "닉네임을 입력해 주세요.";
  if (fields.name.trim().length > 40) return "닉네임은 40자 이하로 입력해 주세요.";
  if (!fields.gender) return "성별을 선택해 주세요.";
  if (!fields.ageText.trim()) return "나이를 입력해 주세요.";
  if (!/^\d+$/.test(fields.ageText.trim())) return "나이를 숫자로 입력해 주세요.";
  const age = parseInt(fields.ageText.trim(), 10);
  if (age < 19 || age > 100) return "나이는 19~100 사이여야 합니다.";
  if (!fields.occupation.trim()) return "직업을 입력해 주세요.";
  if (fields.partyPreferenceText.trim().length < 8) return "선호 스타일을 8자 이상 입력해 주세요.";
  return null;
}

export default function Onboarding() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [ageText, setAgeText] = useState("");
  const [occupation, setOccupation] = useState("");
  const [partyPreferenceText, setPartyPreferenceText] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [profileChecked, setProfileChecked] = useState<"loading" | "none" | "has">("loading");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  if (!hydrated) return <StateView title="계정을 확인하고 있어요" loading />;
  if (!token) return <Redirect href="/login" />;
  if (profileChecked === "loading") return <StateView title="프로필을 확인하고 있어요" loading />;
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
        age: parseInt(ageText, 10),
        gender: gender!,
        occupation: occupation.trim(),
        partyPreferenceText: partyPreferenceText.trim(),
        ...(photoUrl ? { photoUrl } : {}),
      });
      if (!profile.preferenceSignals) {
        router.replace({ pathname: "/home", params: { notice: "선호 분석은 곧 반영됩니다." } });
      } else {
        router.replace("/home");
      }
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "프로필 저장에 실패했습니다.");
      setBusy(false);
    }
  }

  const valid = !validate({ name, gender, ageText, occupation, partyPreferenceText });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppScreen
        header={{ title: "프로필" }}
        body="scroll"
        footer={
          <DoodleButton
            title="시작하기"
            onPress={onSubmit}
            variant="primary"
            disabled={!valid || busy}
            busy={busy}
          />
        }
      >
        <View style={styles.form}>
          <View style={styles.photoSection}>
            <TouchableOpacity
              onPress={onPickPhoto}
              disabled={photoBusy}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="프로필 사진 선택"
            >
              <DoodleAvatar uri={photoUrl} name={name} size={104} />
              {photoBusy ? (
                <View style={styles.photoBusy}>
                  <ActivityIndicator color={colors.ink} />
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
                <InlineNotice tone="error">{photoError}</InlineNotice>
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
          />

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>성별</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((opt) => (
                <DoodleChip
                  key={opt.value}
                  label={opt.label}
                  on={gender === opt.value}
                  onPress={() => setGender(opt.value)}
                />
              ))}
            </View>
            <Text style={styles.fieldHint}>원하지 않으면 ‘응답 안 함’을 선택할 수 있어요.</Text>
          </View>

          <LabeledInput
            label="나이"
            placeholder="예: 25"
            keyboardType="numeric"
            value={ageText}
            onChangeText={setAgeText}
          />

          <LabeledInput
            label="직업"
            placeholder="예: 대학원생"
            maxLength={120}
            value={occupation}
            onChangeText={setOccupation}
          />

          <LabeledInput
            label="함께 놀고 싶은 분위기"
            placeholder="예: 조용히 보드게임 하면서 천천히 친해지는 분위기"
            hint="8자 이상 구체적으로 적을수록 취향에 가까운 파티를 찾기 쉬워요."
            multiline
            numberOfLines={4}
            maxLength={1000}
            value={partyPreferenceText}
            onChangeText={setPartyPreferenceText}
          />

          {submitError ? <InlineNotice tone="error">{submitError}</InlineNotice> : null}
        </View>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: space.x5 },
  photoSection: { alignItems: "center", gap: space.x2, marginBottom: space.x1 },
  photoBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 52,
  },
  photoLink: {
    ...type.label,
    color: colors.ink,
    textDecorationLine: "underline",
  },
  photoLinkButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  photoNotice: { alignSelf: "stretch", marginTop: space.x1 },
  fieldGroup: { gap: space.x2 },
  label: { ...type.label, color: colors.ink },
  fieldHint: { ...type.caption, color: colors.grayDark },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.x2 },
});
