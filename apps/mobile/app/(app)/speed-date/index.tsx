import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ShieldCheck, Mic, Video } from "lucide-react-native";
import { enqueueSpeedDate, cancelSpeedDate, getSpeedDateStatus, ApiError } from "@mingle/client-core";
import { DoodleButton, DoodleCard } from "../../../src/components/Doodle";
import { DoodleChip } from "../../../src/components/DoodleSvg";
import { BackButton } from "../../../src/components/BackButton";
import { colors, layout, space, type } from "../../../src/lib/theme";

const POLL_MS = 2500;
type Phase = "consent" | "joining" | "waiting" | "error";

export default function SpeedDateMatching() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("consent");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startedAt = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);

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

  async function onConsent() {
    setPhase("joining");
    setError(null);
    startedAt.current = Date.now();
    try {
      await enqueueSpeedDate(true);
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <BackButton />
        <Text style={styles.brand}>블라인드 데이트</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: space.x8 + insets.bottom }]}
      >
        {phase === "consent" ? (
          <>
            <Text style={styles.title}>얼굴보다 대화가 먼저</Text>
            <Text style={styles.sub}>
              남 3 · 여 3이 3분씩 1:1로 대화해요. 처음엔 변조된 목소리와 캐릭터로 시작하고,
              단계가 지날수록 진짜 목소리와 얼굴이 공개돼요.
            </Text>

            <DoodleCard tone="fill" contentStyle={styles.stepsCard}>
              <Step icon={<Mic color={colors.ink} size={18} />} title="1. 가면 라운드" body="변조 목소리 + 캐릭터. 별명과 성별만 보여요." />
              <Step icon={<Mic color={colors.accent} size={18} />} title="2. 목소리 공개" body="진짜 목소리로 대화해요. 얼굴은 아직 가림." />
              <Step icon={<Video color={colors.ink} size={18} />} title="3. 얼굴 공개" body="카메라가 켜지고 마지막 대화를 나눠요." />
            </DoodleCard>

            <DoodleCard contentStyle={styles.consentCard}>
              <View style={styles.consentHead}>
                <ShieldCheck color={colors.success} size={20} />
                <Text style={styles.consentTitle}>참여 전 동의</Text>
              </View>
              <Text style={styles.consentBody}>
                만 19세 이상이며, 마지막 단계에서 내 얼굴이 상대에게 공개되는 것에 동의해요.
                언제든 나갈 수 있고, 통화는 저장되지 않아요. 선택은 비공개이며 서로 선택한 경우에만
                채팅이 열려요.
              </Text>
              <View style={styles.chips}>
                <DoodleChip label="19세 이상" tiny />
                <DoodleChip label="녹화 없음" tiny />
                <DoodleChip label="비공개 선택" tiny />
              </View>
            </DoodleCard>

            <DoodleButton title="동의하고 시작" onPress={onConsent} variant="primary" />
          </>
        ) : null}

        {phase === "joining" || phase === "waiting" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.title}>상대를 찾고 있어요</Text>
            <Text style={styles.sub}>
              {phase === "waiting"
                ? `${Math.floor(elapsed / 1000)}초째 · 남3 여3이 모이면 시작해요`
                : "대기열에 등록하는 중…"}
            </Text>
            <DoodleButton title="매칭 취소" onPress={onCancel} />
          </View>
        ) : null}

        {phase === "error" ? (
          <View style={styles.center}>
            <Text style={styles.sub}>{error}</Text>
            <DoodleButton title="다시 시도" onPress={() => setPhase("consent")} variant="primary" />
            <DoodleButton title="홈으로" onPress={() => router.replace("/home")} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIcon}>{icon}</View>
      <View style={styles.stepText}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.screenGutter,
    paddingVertical: space.x2,
  },
  brand: { ...type.heading, color: colors.ink },
  content: {
    flexGrow: 1,
    padding: layout.screenGutter,
    gap: space.x4,
    maxWidth: layout.contentMax,
    width: "100%",
    alignSelf: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.x4, paddingVertical: space.x8 },
  title: { ...type.title, color: colors.ink, textAlign: "center" },
  sub: { ...type.body, color: colors.grayDark, textAlign: "center" },
  stepsCard: { gap: space.x3 },
  stepRow: { flexDirection: "row", gap: space.x3, alignItems: "flex-start" },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { flex: 1 },
  stepTitle: { ...type.label, color: colors.ink },
  stepBody: { ...type.caption, color: colors.grayDark, marginTop: 2 },
  consentCard: { gap: space.x3 },
  consentHead: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  consentTitle: { ...type.heading, color: colors.ink },
  consentBody: { ...type.body, color: colors.grayDark },
  chips: { flexDirection: "row", gap: space.x2, flexWrap: "wrap" },
});
