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

// 성별·나이는 본인인증(verified) 값이 권위 — 온보딩에서 다시 묻지 않는다(2026-07-27 사용자 지시).
function validate(fields: {
  name: string;
  occupation: string;
  partyPreferenceText: string;
}): string | null {
  if (!fields.name.trim()) return "닉네임을 입력해 주세요.";
  if (fields.name.trim().length > 40) return "닉네임은 40자 이하로 입력해 주세요.";
  if (!fields.occupation.trim()) return "직업을 입력해 주세요.";
  if (fields.partyPreferenceText.trim().length < 8) return "선호 스타일을 8자 이상 입력해 주세요.";
  return null;
}

export default function Onboarding() {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);

  const [name, setName] = useState("");
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
        partyPreferenceText: partyPreferenceText.trim(),
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

  const valid = !validate({ name, occupation, partyPreferenceText });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppScreen
        tone="dark"
        body="scroll"
        header={{ title: "당신을 소개해요" }}
        footer={
          <DoodleButton
            title="시작하기"
            onPress={onSubmit}
            variant="primary"
            tone="dark"
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

          <LabeledInput
            label="원하는 만남 분위기"
            placeholder="예: 조용한 카페에서 천천히 친해지는 분위기"
            hint="8자 이상 구체적으로 적을수록 취향에 가까운 상대를 만나기 쉬워요."
            multiline
            numberOfLines={4}
            maxLength={1000}
            value={partyPreferenceText}
            onChangeText={setPartyPreferenceText}
            dark
          />

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
});
