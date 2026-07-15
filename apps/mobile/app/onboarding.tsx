import { colors, doodle } from "../src/lib/theme";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Redirect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createProfile, getMyProfile, ApiError } from "@mingle/client-core";
import { useAuthStore } from "../src/lib/client";
import { useAuthHydrated } from "../src/lib/use-hydrated";
import { DoodleButton, doodleInputStyle } from "../src/components/Doodle";
import { DoodleHero } from "../src/components/DoodleHero";
import { DoodleAvatar } from "../src/components/DoodleAvatar";
import { pickAndUploadPhoto } from "../src/lib/photo";

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
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [ageText, setAgeText] = useState("");
  const [occupation, setOccupation] = useState("");
  const [partyPreferenceText, setPartyPreferenceText] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [profileChecked, setProfileChecked] = useState<"loading" | "none" | "has">("loading");

  const [validationError, setValidationError] = useState<string | null>(null);
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

  if (!hydrated) return null;
  if (!token) return <Redirect href="/login" />;
  if (profileChecked === "loading") return null;
  if (profileChecked === "has") return <Redirect href="/home" />;

  async function onPickPhoto() {
    if (photoBusy) return;
    setPhotoBusy(true);
    const res = await pickAndUploadPhoto();
    setPhotoBusy(false);
    if (res.status === "ok") setPhotoUrl(res.url);
    else if (res.status === "denied")
      Alert.alert("사진 접근 권한 필요", "설정에서 사진 접근을 허용해 주세요.");
    else if (res.status === "error") Alert.alert("사진 업로드 실패", res.message);
  }

  async function onSubmit() {
    if (busy) return;
    const err = validate({ name, gender, ageText, occupation, partyPreferenceText });
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
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

  if (busy) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={styles.loadingText}>선호 분석 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <DoodleHero tagline="가볍게 나를 소개해 볼까요" />

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
        <TouchableOpacity onPress={onPickPhoto} disabled={photoBusy}>
          <Text style={styles.photoLink}>{photoUrl ? "사진 변경" : "사진 추가 (선택)"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>닉네임 / 이름</Text>
      <TextInput
        style={styles.input}
        placeholder="표시될 이름"
        value={name}
        onChangeText={setName}
        maxLength={40}
      />

      <Text style={styles.label}>성별</Text>
      <View style={styles.segmentRow}>
        {GENDER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, gender === opt.value && styles.segmentActive]}
            onPress={() => setGender(opt.value)}
          >
            <Text style={[styles.segmentText, gender === opt.value && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>나이</Text>
      <TextInput
        style={styles.input}
        placeholder="예: 25"
        keyboardType="numeric"
        value={ageText}
        onChangeText={setAgeText}
      />

      <Text style={styles.label}>직업</Text>
      <TextInput
        style={styles.input}
        placeholder="예: 대학원생"
        maxLength={120}
        value={occupation}
        onChangeText={setOccupation}
      />

      <Text style={styles.label}>파티 선호 스타일</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="예: 조용히 보드게임 하면서 천천히 친해지는 분위기"
        multiline
        numberOfLines={4}
        maxLength={1000}
        value={partyPreferenceText}
        onChangeText={setPartyPreferenceText}
      />

      {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <View style={styles.saveWrap}>
        <DoodleButton title="저장하기" onPress={onSubmit} variant="primary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    backgroundColor: colors.paper,
  },
  loadingText: { fontSize: 16, color: colors.grayDark },
  container: { padding: 24, gap: 8, backgroundColor: colors.paper },
  photoSection: { alignItems: "center", gap: 8, marginBottom: 8 },
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
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    textDecorationLine: "underline",
  },
  label: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 12 },
  input: { ...doodleInputStyle, marginTop: 4 },
  multiline: { height: 96, textAlignVertical: "top" },
  segmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  segment: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 12,
    alignItems: "center",
    ...doodle.radius.chip,
  },
  segmentActive: { borderColor: colors.ink, backgroundColor: colors.ink },
  segmentText: { color: colors.ink, fontWeight: "600" },
  segmentTextActive: { color: colors.paper, fontWeight: "700" },
  error: { color: colors.ink, fontWeight: "600", marginTop: 4 },
  saveWrap: { marginTop: 20 },
});
