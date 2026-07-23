import { colors, doodle, fonts, layout, space, type } from "../../src/lib/theme";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View, Text, StyleSheet } from "react-native";
import { router, Redirect } from "expo-router";
import { DoodleButton, DoodleCard } from "../../src/components/Doodle";
import { DoodleChip, DoodleFace } from "../../src/components/DoodleSvg";
import { DoodleAvatar } from "../../src/components/DoodleAvatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  enqueueMatchmaking,
  cancelMatchmaking,
  getMatchmakingStatus,
  ApiError,
  type PublicParty,
} from "@mingle/client-core";
import { FEATURES } from "../../src/lib/features";

const POLL_MS = 2500;

export default function Matching() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<"joining" | "waiting" | "matched" | "failed" | "error">(
    "joining",
  );
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [matchedPartyId, setMatchedPartyId] = useState<string | null>(null);
  const [matchedParty, setMatchedParty] = useState<PublicParty | null>(null);
  // Bumped by "다시 시도" to re-run the enqueue/poll effect deterministically, without relying on
  // a navigator remount (router.replace to the same mounted route may reuse the instance).
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    alive.current = true;

    // Party game is on hold — never enqueue (the <Redirect> below bounces the view home).
    if (!FEATURES.partyGame) {
      return () => {
        alive.current = false;
      };
    }

    async function poll() {
      try {
        const s = await getMatchmakingStatus();
        if (!alive.current) return;
        // FIX B: matched is terminal regardless of whether matchedPartyId is present.
        if (s.status === "matched") {
          if (s.matchedPartyId) {
            setMatchedPartyId(s.matchedPartyId);
            setMatchedParty(s.party ?? null);
            setPhase("matched");
          } else {
            setPhase("failed");
          }
          return;
        }
        if (s.status === "cancelled" || s.status === "none") {
          setPhase("failed");
          return;
        }
        setPhase("waiting");
        setElapsed(s.elapsedMs ?? 0);
        setEstimatedWait(s.estimatedWaitMs ?? null);
        timerRef.current = setTimeout(poll, POLL_MS);
      } catch (e) {
        if (!alive.current) return;
        setError(e instanceof ApiError ? e.message : "매칭 상태를 불러오지 못했습니다.");
        setPhase("error");
      }
    }

    (async () => {
      try {
        await enqueueMatchmaking();
        if (!alive.current) return;
        setPhase("waiting");
        poll();
      } catch (e) {
        if (!alive.current) return;
        // enqueue 거부가 "이미 매칭됨"(파티 참여 중 409)일 수 있다 — 상태를 확인해
        // matched면 poll()의 기존 경로가 파티로 바로 보낸다 (QA ISSUE-001: 매칭된
        // 사용자가 파티로 돌아갈 UI 경로가 없던 막다른 화면 제거).
        setError(e instanceof ApiError ? e.message : "매칭을 시작하지 못했습니다.");
        poll();
      }
    })();

    return () => {
      alive.current = false;
      clearTimeout(timerRef.current);
    };
  }, [attempt]);

  function onRetry() {
    setError(null);
    setElapsed(0);
    setEstimatedWait(null);
    setMatchedPartyId(null);
    setMatchedParty(null);
    setPhase("joining");
    setAttempt((a) => a + 1);
  }

  async function onCancel() {
    alive.current = false;
    clearTimeout(timerRef.current);
    try {
      await cancelMatchmaking();
    } catch {
      // ignore — leaving the screen is the intent
    }
    router.replace("/home");
  }

  function onEnterParty() {
    if (!matchedPartyId) return;
    router.replace({ pathname: "/(app)/party/[id]", params: { id: matchedPartyId } });
  }

  // Party game disabled — render nothing but the redirect (the effect above skipped enqueue).
  if (!FEATURES.partyGame) return <Redirect href="/home" />;

  if (phase === "failed") {
    return (
      <View
        style={[styles.center, { paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right }]}
      >
        <Text style={styles.msg}>지금은 매칭이 어려워요. 잠시 후 다시 시도해 주세요.</Text>
        <DoodleButton title="다시 시도" onPress={onRetry} variant="primary" />
        <DoodleButton title="홈으로" onPress={() => router.replace("/home")} />
      </View>
    );
  }
  if (phase === "error") {
    return (
      <View
        style={[styles.center, { paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right }]}
      >
        <Text style={styles.error}>{error}</Text>
        <DoodleButton title="홈으로" onPress={() => router.replace("/home")} />
      </View>
    );
  }
  if (phase === "matched") {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.matchedContainer,
          {
            paddingTop: space.x6 + insets.top,
            paddingBottom: space.x6 + insets.bottom,
            paddingLeft: layout.screenGutter + insets.left,
            paddingRight: layout.screenGutter + insets.right,
          },
        ]}
      >
        <View style={styles.successMark} accessibilityElementsHidden>
          <DoodleFace variant="open" size={70} />
        </View>
        <DoodleChip label="MATCH FOUND" />
        <Text style={styles.successTitle} accessibilityRole="header">
          함께 놀 멤버를 찾았어요!
        </Text>
        <Text style={styles.successSub}>
          먼저 가볍게 움직이고 게임하며 분위기를 알아보세요. 프로포즈는 게임 중 또는 끝난 뒤
          직접 선택할 수 있어요.
        </Text>

        <DoodleCard style={styles.partyCard} contentStyle={styles.partyCardInner}>
          <View style={styles.cardHeadingRow}>
            <Text style={styles.cardTitle}>오늘의 파티</Text>
            <Text style={styles.memberCount}>
              {matchedParty ? `${matchedParty.participants.length}명` : "확인 중"}
            </Text>
          </View>
          <View style={styles.avatarRow}>
            {(matchedParty?.participants ?? []).slice(0, 4).map((member) => (
              <View key={member.profileId} style={styles.avatarItem}>
                <DoodleAvatar uri={member.photoUrl} name={member.name} size={48} />
                <Text style={styles.avatarName} numberOfLines={1}>
                  {member.name}
                </Text>
              </View>
            ))}
            {!matchedParty ? <Text style={styles.loadingMembers}>멤버 정보를 준비하고 있어요</Text> : null}
          </View>
        </DoodleCard>

        <View style={styles.readyList}>
          <View style={styles.readyRow}>
            <Text style={styles.readyNumber}>1</Text>
            <View style={styles.readyTextWrap}>
              <Text style={styles.readyTitle}>월드를 둘러보기</Text>
              <Text style={styles.readySub}>조이스틱으로 이동하고 가까운 멤버의 프로필을 열어요.</Text>
            </View>
          </View>
          <View style={styles.readyRow}>
            <Text style={styles.readyNumber}>2</Text>
            <View style={styles.readyTextWrap}>
              <Text style={styles.readyTitle}>게임으로 대화 시작하기</Text>
              <Text style={styles.readySub}>밸런스 게임과 파티 채팅으로 자연스럽게 취향을 나눠요.</Text>
            </View>
          </View>
        </View>

        <View style={styles.footerActions}>
          <DoodleButton title="게임 월드 입장" onPress={onEnterParty} variant="primary" />
          <Text style={styles.safetyCopy}>언제든 나갈 수 있고, 신고·차단은 상대에게 알려지지 않아요.</Text>
        </View>
      </ScrollView>
    );
  }

  const waitedSeconds = Math.floor(elapsed / 1000);
  const etaMinutes = estimatedWait ? Math.max(1, Math.ceil(estimatedWait / 60000)) : null;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.waitContainer,
        {
          paddingTop: space.x8 + insets.top,
          paddingBottom: space.x6 + insets.bottom,
          paddingLeft: layout.screenGutter + insets.left,
          paddingRight: layout.screenGutter + insets.right,
        },
      ]}
    >
      <View style={styles.faceWrap}>
        <DoodleFace variant="open" size={76} />
        <ActivityIndicator color={colors.accent} size="small" />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        잘 맞는 파티를 찾고 있어요
      </Text>
      <Text style={styles.sub} accessibilityLiveRegion="polite">
        {phase === "waiting"
          ? `${waitedSeconds}초째 탐색 중${etaMinutes ? ` · 보통 ${etaMinutes}분 안에 만나요` : ""}`
          : "취향과 안전 조건을 확인하는 중이에요"}
      </Text>

      <DoodleCard tone="fill" style={styles.criteriaCard} contentStyle={styles.criteriaInner}>
        <Text style={styles.criteriaTitle}>지금 확인하는 조건</Text>
        <View style={styles.criteriaGrid}>
          <DoodleChip label="대화 취향" tiny />
          <DoodleChip label="활동 시간" tiny />
          <DoodleChip label="안전 기준" tiny />
          <DoodleChip label="4인 파티" tiny />
        </View>
        <Text style={styles.criteriaCopy}>
          빠른 연결보다 대화가 이어질 가능성을 우선해요. 화면을 벗어나도 매칭은 유지되지 않아요.
        </Text>
      </DoodleCard>

      <View style={styles.waitActions}>
        <DoodleButton title="매칭 취소" onPress={onCancel} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    padding: 24,
    backgroundColor: colors.paper,
  },
  screen: { flex: 1, backgroundColor: colors.paper },
  waitContainer: { flexGrow: 1, alignItems: "center", gap: space.x4 },
  matchedContainer: {
    flexGrow: 1,
    alignItems: "center",
    gap: space.x3,
    maxWidth: layout.contentMax,
    width: "100%",
    alignSelf: "center",
  },
  faceWrap: { minHeight: 104, alignItems: "center", justifyContent: "center", gap: space.x2 },
  successMark: { marginBottom: -4 },
  title: { ...type.title, color: colors.ink, textAlign: "center" },
  successTitle: { ...type.display, color: colors.ink, textAlign: "center" },
  successSub: { ...type.body, color: colors.grayDark, textAlign: "center", maxWidth: 460 },
  msg: { fontSize: 16, color: colors.ink, fontWeight: "600" },
  sub: { ...type.body, color: colors.grayDark, textAlign: "center" },
  error: { color: colors.ink, textAlign: "center" },
  criteriaCard: { width: "100%", maxWidth: 460, marginTop: space.x3 },
  criteriaInner: { gap: space.x3 },
  criteriaTitle: { ...type.heading, color: colors.ink },
  criteriaGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.x2 },
  criteriaCopy: { ...type.caption, color: colors.grayDark },
  waitActions: { width: "100%", maxWidth: 460, marginTop: "auto", paddingTop: space.x8 },
  partyCard: { width: "100%", marginTop: space.x3 },
  partyCardInner: { gap: space.x4 },
  cardHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { ...type.heading, color: colors.ink },
  memberCount: { ...type.label, color: colors.grayDark },
  avatarRow: { flexDirection: "row", justifyContent: "center", gap: space.x4, minHeight: 72 },
  avatarItem: { width: 58, alignItems: "center", gap: space.x1 },
  avatarName: { ...type.caption, color: colors.ink, maxWidth: 58 },
  loadingMembers: { ...type.body, color: colors.grayDark, alignSelf: "center" },
  readyList: { width: "100%", gap: space.x3, paddingVertical: space.x3 },
  readyRow: { flexDirection: "row", gap: space.x3, alignItems: "flex-start" },
  readyNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.ink,
    color: colors.paper,
    textAlign: "center",
    lineHeight: 28,
    fontWeight: "800",
  },
  readyTextWrap: { flex: 1 },
  readyTitle: { ...type.label, color: colors.ink },
  readySub: { ...type.caption, color: colors.grayDark, marginTop: 2 },
  footerActions: { width: "100%", gap: space.x2, marginTop: "auto" },
  safetyCopy: { ...type.caption, color: colors.grayDark, textAlign: "center" },
});
