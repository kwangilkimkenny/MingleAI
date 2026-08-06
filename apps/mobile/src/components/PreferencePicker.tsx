/**
 * PreferencePicker — 온보딩·프로필 편집 공용 선호 입력(2026-08-06).
 *
 * 자유서술을 폐기하고 선택지로 받는다: 사용자가 구체적으로 적지 않으면 매칭 신호가 되지 못했기
 * 때문. 여기서 고른 값이 `@mingle/shared`의 점수 축(vibe·pace·drinking·activity)으로 그대로
 * 매핑된다. 한 줄 소개는 선택 — 신호가 아니라 상대에게 보이는 색깔.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import {
  ACTIVITY_OPTIONS,
  DRINKING_OPTIONS,
  MAX_ACTIVITIES,
  MAX_NOTE_LENGTH,
  PACE_OPTIONS,
  VIBE_OPTIONS,
  type PreferenceAnswers,
  type PreferenceOption,
} from "@mingle/client-core";
import { LabeledInput } from "./Foundation";
import { dark, space, type } from "../lib/theme";

export type { PreferenceAnswers };

export const EMPTY_ANSWERS: PreferenceAnswers = {
  vibe: "balanced",
  pace: "medium",
  drinking: "light",
  activities: [],
};

/** 필수 축이 모두 채워졌는지(활동 1개 이상). */
export function answersComplete(a: PreferenceAnswers): boolean {
  return a.activities.length > 0;
}

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Row<T extends string>({
  title,
  hint,
  options,
  value,
  onSelect,
}: {
  title: string;
  hint?: string;
  options: readonly PreferenceOption<T>[];
  value: T;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.chipRow}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} on={value === o.value} onPress={() => onSelect(o.value)} />
        ))}
      </View>
    </View>
  );
}

export function PreferencePicker({
  value,
  onChange,
}: {
  value: PreferenceAnswers;
  onChange: (next: PreferenceAnswers) => void;
}) {
  const atMax = value.activities.length >= MAX_ACTIVITIES;

  function toggleActivity(id: string) {
    const has = value.activities.includes(id);
    if (!has && atMax) return;
    onChange({
      ...value,
      activities: has ? value.activities.filter((a) => a !== id) : [...value.activities, id],
    });
  }

  return (
    <View style={styles.root}>
      <Row
        title="어떤 분위기가 좋아요?"
        options={VIBE_OPTIONS}
        value={value.vibe}
        onSelect={(vibe) => onChange({ ...value, vibe })}
      />
      <Row
        title="가까워지는 속도는요?"
        options={PACE_OPTIONS}
        value={value.pace}
        onSelect={(pace) => onChange({ ...value, pace })}
      />
      <Row
        title="술은 어때요?"
        options={DRINKING_OPTIONS}
        value={value.drinking}
        onSelect={(drinking) => onChange({ ...value, drinking })}
      />

      <View style={styles.group}>
        <Text style={styles.label}>같이 하고 싶은 것</Text>
        <Text style={styles.hint}>최대 {MAX_ACTIVITIES}개 · {value.activities.length}/{MAX_ACTIVITIES}</Text>
        <View style={styles.chipRow}>
          {ACTIVITY_OPTIONS.map((o) => {
            const on = value.activities.includes(o.value);
            return (
              <Chip key={o.value} label={o.label} on={on} onPress={() => toggleActivity(o.value)} />
            );
          })}
        </View>
      </View>

      <LabeledInput
        dark
        label="한 줄 소개 (선택)"
        placeholder="예: 사진 찍으며 걷는 걸 좋아해요"
        maxLength={MAX_NOTE_LENGTH}
        value={value.note ?? ""}
        onChangeText={(note) => onChange({ ...value, note })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.x4 },
  group: { gap: space.x2 },
  label: { ...type.label, color: dark.text },
  hint: { ...type.caption, color: dark.textMuted },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.x2 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.x4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
  },
  chipOn: { backgroundColor: dark.surfaceHi, borderColor: dark.text },
  chipText: { ...type.label, color: dark.textMuted },
  chipTextOn: { color: dark.text },
  pressed: { opacity: 0.72 },
});
