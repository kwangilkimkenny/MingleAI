import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import {
  enqueueSpeedDate,
  cancelSpeedDate,
  getSpeedDateStatus,
  getMyProfile,
  ApiError,
} from "@mingle/client-core";
import { AppScreen } from "../../../src/components/AppScreen";
import { DoodleButton } from "../../../src/components/Doodle";
import { DoodleChip } from "../../../src/components/DoodleSvg";
import { StateView } from "../../../src/components/Foundation";
import { AppMap } from "../../../src/components/AppMap";
import { isSpeedDateEligibleGender } from "../../../src/lib/speed-date-eligibility";
import { getCameraMicStatus } from "../../../src/lib/permissions";
import { requestLocation, type Coords } from "../../../src/lib/location";
import { dark, space, type } from "../../../src/lib/theme";
import { serifFont } from "../../../src/lib/serif";

const POLL_MS = 2500;
type Phase = "checking" | "consent" | "ineligible" | "joining" | "waiting" | "error";
type Step = "rules" | "location";

/** Match-distance options; null = no distance limit (skip location entirely). */
const RADIUS_OPTIONS: { km: number | null; label: string }[] = [
  { km: 1, label: "1km" },
  { km: 5, label: "5km" },
  { km: 10, label: "10km" },
  { km: 30, label: "30km" },
  { km: null, label: "제한 없음" },
];

/** 상세 룰 — 처음 화면에서 진행 방식을 자세히 안내한다. */
const RULES: { n: string; title: string; body: string }[] = [
  { n: "1", title: "여섯 명이 모이면 시작", body: "남성 3명 · 여성 3명이 모이면 라운드가 열려요." },
  { n: "2", title: "돌아가며 대화", body: "여러 상대와 라운드로 순환하며 짧게 대화해요(로테이션)." },
  { n: "3", title: "단계적 공개", body: "가면 라운드(음성 변조) → 목소리 공개 → 얼굴 공개 순으로 열려요." },
  { n: "4", title: "비공개 상호 선택", body: "라운드가 끝나면 마음이 가는 상대를 비공개로 골라요." },
  { n: "5", title: "서로 고르면 매칭", body: "둘 다 서로를 골랐을 때만 1:1 채팅이 열려요." },
];

export default function SpeedDateMatching() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("checking");
  const [step, setStep] = useState<Step>("rules");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [radiusKm, setRadiusKm] = useState<number | null>(10);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locBusy, setLocBusy] = useState(false);
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

  /** 세션 필수 권한(카메라·마이크) — 없으면 프라이밍 화면으로 보낸다(허용 후 back으로 복귀). */
  async function ensureAvPermissions(): Promise<boolean> {
    const perms = await getCameraMicStatus();
    if (perms.camera && perms.microphone) return true;
    router.push("/permissions");
    return false;
  }

  // 룰 → 다음: 세션 권한 확인 후 지도 단계로 이동하며 현위치를 요청한다(위치는 옵션 권한).
  async function onNext() {
    if (!(await ensureAvPermissions())) return;
    setStep("location");
    if (coords || locBusy) return;
    setLocBusy(true);
    try {
      const loc = await requestLocation();
      if (alive.current && loc.coords) setCoords(loc.coords);
    } finally {
      if (alive.current) setLocBusy(false);
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

  /** 진행 중 세션이 있으면 그 세션으로 복귀. 복귀했으면 true. */
  async function rejoinActiveSession(): Promise<boolean> {
    try {
      const s = await getSpeedDateStatus();
      if (alive.current && s.status === "matched" && s.sessionId) {
        router.replace({ pathname: "/(app)/speed-date/[id]", params: { id: s.sessionId } });
        return true;
      }
    } catch {
      // 상태 조회 실패는 무시 — 아래 enqueue가 원래 에러를 보여준다.
    }
    return false;
  }

  async function onStart() {
    // 안전망 — 룰 단계를 딥링크로 건너뛴 경우에도 세션 권한 없이는 큐에 못 들어간다.
    if (!(await ensureAvPermissions())) return;
    setPhase("joining");
    setError(null);
    startedAt.current = Date.now();
    // 실수로 세션에서 나온 경우(뒤로가기 등) — 새 매칭 대신 진행 중인 세션으로 되돌린다.
    if (await rejoinActiveSession()) return;
    try {
      // 거리를 골랐고 위치가 있으면 반경 매칭, 아니면 좌표 없이 등록(누구나 매칭).
      const geo =
        radiusKm !== null && coords
          ? { lat: coords.lat, lng: coords.lng, radiusKm }
          : undefined;
      await enqueueSpeedDate(geo);
      if (!alive.current) return;
      setPhase("waiting");
      poll();
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof ApiError && e.status === 409 && (await rejoinActiveSession())) return;
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

  // Location step = full-bleed map with floating controls (chips + start hover over the map).
  if (isConsent && step === "location") {
    return (
      <View style={styles.mapScreen}>
        <View style={StyleSheet.absoluteFill}>
          {coords ? (
            <AppMap center={coords} radiusKm={radiusKm} places={[]} />
          ) : (
            <View style={styles.mapFallback}>
              {locBusy ? <ActivityIndicator color={dark.textMuted} /> : null}
              <Text style={styles.mapFallbackText}>
                {locBusy
                  ? "현위치를 확인하고 있어요…"
                  : "위치를 확인할 수 없어요. ‘제한 없음’으로 시작할 수 있어요."}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={() => setStep("rules")}
          style={[styles.floatBack, { top: insets.top + space.x2 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <ChevronLeft color={dark.text} size={24} strokeWidth={2.5} />
        </Pressable>

        <View style={[styles.dock, { paddingBottom: insets.bottom + space.x4 }]}>
          <View style={styles.dockChips}>
            {RADIUS_OPTIONS.map((opt) => (
              <RadiusPill
                key={opt.label}
                label={opt.label}
                on={radiusKm === opt.km}
                onPress={() => setRadiusKm(opt.km)}
              />
            ))}
          </View>
          <DoodleButton title="시작하기" onPress={onStart} variant="primary" tone="dark" />
        </View>
      </View>
    );
  }

  const footer =
    isConsent && step === "rules" ? (
      <DoodleButton title="다음" onPress={onNext} variant="primary" tone="dark" />
    ) : phase === "joining" || phase === "waiting" ? (
      <DoodleButton title="매칭 취소" onPress={onCancel} tone="dark" />
    ) : phase === "error" ? (
      <DoodleButton title="홈으로" onPress={() => router.replace("/home")} tone="dark" />
    ) : undefined;

  const scrollBody = isConsent && step === "rules";

  return (
    <AppScreen
      tone="dark"
      header={{ title: "", back: true }}
      body={scrollBody ? "scroll" : "plain"}
      footer={footer}
    >
      {phase === "checking" ? (
        <StateView title="참여 가능 여부를 확인하고 있어요" loading dark />
      ) : null}

      {phase === "ineligible" ? (
        <StateView
          title="현재 참여할 수 없어요"
          body="아직은 남성·여성 간 매칭만 제공해요."
          actionLabel="홈으로"
          onAction={() => router.replace("/home")}
          dark
        />
      ) : null}

      {isConsent && step === "rules" ? (
        <View style={styles.rulesStack}>
          <Text style={styles.title}>이렇게 진행돼요</Text>
          <View style={styles.rules}>
            {RULES.map((r, i) => (
              <RuleRow key={r.n} rule={r} last={i === RULES.length - 1} />
            ))}
          </View>
          <View style={styles.chips}>
            <DoodleChip label="녹화 없음" tiny dark />
            <DoodleChip label="선택은 비공개" tiny dark />
          </View>
        </View>
      ) : null}

      {phase === "joining" || phase === "waiting" ? (
        <StateView
          title="상대를 찾고 있어요"
          body={
            phase === "waiting"
              ? `${Math.floor(elapsed / 1000)}초째 · 남녀 3명씩 모이면 시작해요`
              : "대기열에 등록하는 중…"
          }
          loading
          dark
        />
      ) : null}

      {phase === "error" ? (
        <StateView
          title="문제가 생겼어요"
          body={error ?? undefined}
          actionLabel="다시 시도"
          onAction={loadEligibility}
          dark
        />
      ) : null}
    </AppScreen>
  );
}

/** Opaque radius pill for the map overlay — needs a solid bg to stay legible over map tiles. */
function RadiusPill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, on ? styles.pillOn : styles.pillOff]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      hitSlop={6}
    >
      <Text style={[styles.pillText, { color: on ? dark.text : dark.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

function RuleRow({ rule, last }: { rule: { n: string; title: string; body: string }; last: boolean }) {
  return (
    <View style={[styles.ruleRow, !last && styles.ruleDivider]}>
      <View style={styles.ruleNum}>
        <Text style={styles.ruleNumText}>{rule.n}</Text>
      </View>
      <View style={styles.ruleText}>
        <Text style={styles.ruleTitle}>{rule.title}</Text>
        <Text style={styles.ruleBody}>{rule.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rulesStack: { gap: space.x4, paddingTop: space.x2 },
  title: { ...type.title, fontFamily: serifFont, color: dark.text, textAlign: "center" },
  rules: { marginTop: space.x2 },
  ruleRow: { flexDirection: "row", gap: space.x3, alignItems: "flex-start", paddingVertical: space.x3 },
  ruleDivider: { borderBottomWidth: 1, borderBottomColor: dark.line },
  ruleNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: dark.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  ruleNumText: { fontFamily: serifFont, fontSize: 14, color: dark.accent },
  ruleText: { flex: 1, gap: 2 },
  ruleTitle: { ...type.label, color: dark.text },
  ruleBody: { ...type.caption, color: dark.textMuted },
  chips: { flexDirection: "row", gap: space.x2, flexWrap: "wrap", justifyContent: "center" },
  // Full-bleed location step
  mapScreen: { flex: 1, backgroundColor: dark.bg },
  mapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.x2,
    padding: space.x5,
    backgroundColor: dark.surface,
  },
  mapFallbackText: { ...type.body, color: dark.textMuted, textAlign: "center" },
  floatBack: {
    position: "absolute",
    left: space.x4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(20,14,9,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.x4,
    paddingTop: space.x5,
    gap: space.x3,
  },
  dockChips: { flexDirection: "row", gap: 6, flexWrap: "nowrap", justifyContent: "center" },
  pill: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
  },
  pillOff: { backgroundColor: dark.surface, borderColor: dark.border },
  pillOn: { backgroundColor: dark.surfaceHi, borderColor: dark.text },
  pillText: { ...type.caption },
});
