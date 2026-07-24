import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Mic, Video } from "lucide-react-native";
import {
  enqueueSpeedDate,
  cancelSpeedDate,
  getSpeedDateStatus,
  getMyProfile,
  ApiError,
} from "@mingle/client-core";
import { AppScreen } from "../../../src/components/AppScreen";
import { DoodleButton, DoodleCard } from "../../../src/components/Doodle";
import { DoodleChip } from "../../../src/components/DoodleSvg";
import { StateView } from "../../../src/components/Foundation";
import { isSpeedDateEligibleGender } from "../../../src/lib/speed-date-eligibility";
import { requestLocation } from "../../../src/lib/location";
import { colors, space, type } from "../../../src/lib/theme";

const POLL_MS = 2500;
type Phase = "checking" | "consent" | "ineligible" | "joining" | "waiting" | "error";

/** Match-distance options; null = no distance limit (skip location entirely). */
const RADIUS_OPTIONS: { km: number | null; label: string }[] = [
  { km: 5, label: "5km" },
  { km: 10, label: "10km" },
  { km: 30, label: "30km" },
  { km: 50, label: "50km" },
  { km: null, label: "제한 없음" },
];

export default function SpeedDateMatching() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [radiusKm, setRadiusKm] = useState<number | null>(10);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startedAt = useRef(0);

  useEffect(() => {
    alive.current = true;
    loadEligibility();
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  async function loadEligibility() {
    setPhase("checking");
    setError(null);
    try {
      const profile = await getMyProfile();
      if (!alive.current) return;
      setPhase(profile && isSpeedDateEligibleGender(profile.gender) ? "consent" : "ineligible");
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof ApiError ? e.message : "프로필을 확인하지 못했어요.");
      setPhase("error");
    }
  }

  async function poll() {
    try {
      const s = await getSpeedDateStatus();
      if (!alive.current) return;
      if (s.status === "matched" && s.sessionId) {
        router.replace({ pathname: "/(app)/speed-date/[id]", params: { id: s.sessionId } });
        return;
      }
      if (s.status === "idle") {
        setError("매칭이 종료됐어요. 다시 시도해 주세요.");
        setPhase("error");
        return;
      }
      setPhase("waiting");
      setElapsed(Date.now() - startedAt.current);
      timer.current = setTimeout(poll, POLL_MS);
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof ApiError ? e.message : "상태를 불러오지 못했어요.");
      setPhase("error");
    }
  }

  async function onStart() {
    setPhase("joining");
    setError(null);
    startedAt.current = Date.now();
    try {
      // Location is optional: request it only when a radius is chosen; if granted, match within
      // that radius, otherwise enqueue without coords (matches anyone).
      let geo: { lat: number; lng: number; radiusKm: number } | undefined;
      if (radiusKm !== null) {
        const loc = await requestLocation();
        if (loc.coords) geo = { lat: loc.coords.lat, lng: loc.coords.lng, radiusKm };
      }
      await enqueueSpeedDate(geo);
      if (!alive.current) return;
      setPhase("waiting");
      poll();
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof ApiError ? e.message : "매칭을 시작하지 못했어요.");
      setPhase("error");
    }
  }

  async function onCancel() {
    alive.current = false;
    clearTimeout(timer.current);
    try {
      await cancelSpeedDate();
    } catch {
      // leaving is the intent
    }
    router.replace("/home");
  }

  const isConsent = phase === "consent";
  const footer = isConsent ? (
    <DoodleButton title="시작하기" onPress={onStart} variant="primary" />
  ) : phase === "joining" || phase === "waiting" ? (
    <DoodleButton title="매칭 취소" onPress={onCancel} />
  ) : phase === "error" ? (
    <DoodleButton title="홈으로" onPress={() => router.replace("/home")} />
  ) : undefined;

  return (
    <AppScreen
      header={{ title: "블라인드 데이트", back: true }}
      body={isConsent ? "scroll" : "plain"}
      footer={footer}
    >
      {phase === "checking" ? (
        <StateView title="참여 가능 여부를 확인하고 있어요" loading />
      ) : null}

      {phase === "ineligible" ? (
        <StateView
          title="현재 참여할 수 없어요"
          body="지금은 남성·여성 매칭만 지원해요."
          actionLabel="홈으로"
          onAction={() => router.replace("/home")}
        />
      ) : null}

      {isConsent ? (
        <View style={styles.stack}>
          <Text style={styles.title}>얼굴보다 대화가 먼저</Text>

          <DoodleCard tone="fill" contentStyle={styles.stepsCard}>
            <Step icon={<Mic color={colors.ink} size={18} strokeWidth={1.75} />} title="가면 라운드" />
            <Step icon={<Mic color={colors.accent} size={18} strokeWidth={1.75} />} title="목소리 공개" />
            <Step icon={<Video color={colors.ink} size={18} strokeWidth={1.75} />} title="얼굴 공개" />
          </DoodleCard>

          <View style={styles.chips}>
            <DoodleChip label="녹화 없음" tiny />
            <DoodleChip label="비공개 선택" tiny />
          </View>

          <View style={styles.radiusBlock}>
            <Text style={styles.radiusLabel}>매칭 거리</Text>
            <View style={styles.radiusChips}>
              {RADIUS_OPTIONS.map((opt) => (
                <DoodleChip
                  key={opt.label}
                  label={opt.label}
                  on={radiusKm === opt.km}
                  tiny
                  onPress={() => setRadiusKm(opt.km)}
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {phase === "joining" || phase === "waiting" ? (
        <StateView
          title="상대를 찾고 있어요"
          body={
            phase === "waiting"
              ? `${Math.floor(elapsed / 1000)}초째 · 남3 여3이 모이면 시작해요`
              : "대기열에 등록하는 중…"
          }
          loading
        />
      ) : null}

      {phase === "error" ? (
        <StateView
          title="문제가 생겼어요"
          body={error ?? undefined}
          actionLabel="다시 시도"
          onAction={loadEligibility}
        />
      ) : null}
    </AppScreen>
  );
}

function Step({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIcon}>{icon}</View>
      <Text style={styles.stepTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.x4 },
  title: { ...type.title, color: colors.heading, textAlign: "center" },
  stepsCard: { gap: space.x3 },
  stepRow: { flexDirection: "row", gap: space.x3, alignItems: "center" },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: { ...type.label, color: colors.ink },
  chips: { flexDirection: "row", gap: space.x2, flexWrap: "wrap", justifyContent: "center" },
  radiusBlock: { gap: space.x2, alignItems: "center" },
  radiusLabel: { ...type.label, color: colors.ink },
  radiusChips: { flexDirection: "row", gap: space.x2, flexWrap: "wrap", justifyContent: "center" },
});
