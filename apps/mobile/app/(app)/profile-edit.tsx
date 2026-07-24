import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getMyProfile, updateProfile, ApiError } from "@mingle/client-core";
import { DoodleAvatar } from "../../src/components/DoodleAvatar";
import { AppScreen } from "../../src/components/AppScreen";
import { DoodleButton } from "../../src/components/Doodle";
import { InlineNotice, LabeledInput, StateView } from "../../src/components/Foundation";
import { pickAndUploadPhoto } from "../../src/lib/photo";
import { dark, space, type } from "../../src/lib/theme";

const GENDER_LABEL: Record<string, string> = {
  male: "남성",
  female: "여성",
  non_binary: "논바이너리",
  prefer_not_to_say: "비공개",
};

/**
 * 내 정보 — 온보딩에서 작성한 프로필(이름·직업·분위기·사진)을 수정한다. 나이·성별은 본인인증에서
 * 온 권위값이라 읽기 전용으로 보여준다(수정 불가). 홈 테마(다크) Flow.
 */
export default function ProfileEditScreen() {
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [pref, setPref] = useState("");
  const [ageGender, setAgeGender] = useState<{ age: number; gender: string } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    setLoadState("loading");
    getMyProfile()
      .then((p) => {
        if (!alive) return;
        if (!p) {
          setLoadState("error");
          return;
        }
        setId(p.id);
        setName(p.name);
        setOccupation(p.occupation);
        setPref(p.partyPreferenceText);
        setAgeGender({ age: p.age, gender: p.gender });
        setPhotoUrl(p.photoUrl);
        setLoadState("ready");
      })
      .catch(() => {
        if (alive) setLoadState("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(load);

  async function onChangePhoto() {
    if (photoBusy || !id) return;
    setError(null);
    setPhotoBusy(true);
    const res = await pickAndUploadPhoto();
    if (res.status === "ok") {
      try {
        const updated = await updateProfile(id, { photoUrl: res.url });
        setPhotoUrl(updated.photoUrl);
      } catch (e) {
        setError(e instanceof Error ? e.message : "사진을 저장하지 못했어요.");
      }
    } else if (res.status === "denied") {
      setError("사진을 변경하려면 기기 설정에서 사진 접근을 허용해 주세요.");
    } else if (res.status === "error") {
      setError(res.message);
    }
    setPhotoBusy(false);
  }

  const valid =
    name.trim().length > 0 && occupation.trim().length > 0 && pref.trim().length >= 8;

  async function onSave() {
    if (!id || !valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateProfile(id, {
        name: name.trim(),
        occupation: occupation.trim(),
        partyPreferenceText: pref.trim(),
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "저장하지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  if (loadState === "loading") {
    return (
      <AppScreen tone="dark" header={{ back: true, title: "내 정보" }} body="plain">
        <StateView title="내 정보를 불러오고 있어요" loading dark />
      </AppScreen>
    );
  }
  if (loadState === "error") {
    return (
      <AppScreen tone="dark" header={{ back: true, title: "내 정보" }} body="plain">
        <StateView title="불러오지 못했어요" actionLabel="다시 시도" onAction={load} dark />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      tone="dark"
      header={{ back: true, title: "내 정보" }}
      body="scroll"
      contentStyle={styles.content}
      footer={
        <DoodleButton
          title={busy ? "저장 중…" : "저장"}
          variant="primary"
          tone="dark"
          disabled={!valid || busy}
          onPress={onSave}
        />
      }
    >
      <View style={styles.photoRow}>
        <TouchableOpacity
          onPress={onChangePhoto}
          disabled={photoBusy}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="프로필 사진 변경"
        >
          <DoodleAvatar uri={photoUrl} name={name} size={72} />
          {photoBusy ? (
            <View style={styles.photoBusy}>
              <ActivityIndicator color={dark.text} />
            </View>
          ) : null}
        </TouchableOpacity>
        <Text style={styles.photoHint}>사진을 눌러 변경</Text>
      </View>

      {error ? <InlineNotice tone="error" dark>{error}</InlineNotice> : null}

      <LabeledInput dark label="닉네임 / 이름" value={name} onChangeText={setName} maxLength={20} />
      <LabeledInput dark label="직업" value={occupation} onChangeText={setOccupation} maxLength={30} />
      <LabeledInput
        dark
        label="함께 놀고 싶은 분위기"
        value={pref}
        onChangeText={setPref}
        multiline
        maxLength={300}
        hint="8자 이상. 어떤 만남을 원하는지 자유롭게 적어주세요."
      />

      {ageGender ? (
        <View style={styles.readonly}>
          <Text style={styles.readonlyLabel}>나이 · 성별</Text>
          <Text style={styles.readonlyValue}>
            {ageGender.age}세 · {GENDER_LABEL[ageGender.gender] ?? ageGender.gender}
          </Text>
          <Text style={styles.readonlyNote}>본인인증으로 설정된 값이라 바꿀 수 없어요.</Text>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.x4, gap: space.x4 },
  photoRow: { alignItems: "center", gap: space.x2 },
  photoBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(26,18,12,0.6)",
    borderRadius: 36,
  },
  photoHint: { ...type.caption, color: dark.textMuted },
  readonly: {
    marginTop: space.x2,
    paddingTop: space.x4,
    borderTopWidth: 1,
    borderTopColor: dark.line,
    gap: 3,
  },
  readonlyLabel: { ...type.label, color: dark.label },
  readonlyValue: { ...type.body, color: dark.text },
  readonlyNote: { ...type.caption, color: dark.textMuted },
});
