import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { Mic, MicOff } from "lucide-react-native";
import type { SpeedDateSnapshot, SpeedDateStage, PartnerView } from "@mingle/client-core";
import { DoodleButton, DoodleCard } from "../../../src/components/Doodle";
import { DoodleChip } from "../../../src/components/DoodleSvg";
import { SpeedDateAvatar } from "../../../src/components/speed-date/SpeedDateAvatar";
import { SuggestedQuestion } from "../../../src/components/speed-date/SuggestedQuestion";
import { openSpeedDateSocket } from "../../../src/lib/speed-date-socket";
import { useSpeedDateMedia } from "../../../src/lib/speed-date-media";
import { VideoView } from "../../../src/components/speed-date/VideoView";
import { useAuthStore } from "../../../src/lib/client";
import { hapticSelect } from "../../../src/lib/haptics";
import { serifFont } from "../../../src/lib/serif";
import { ConfirmDialog } from "../../../src/components/Foundation";
import { colors, dark, layout, space, type } from "../../../src/lib/theme";

const STAGE_HINT: Record<SpeedDateStage, string> = {
  DISGUISED: "목소리는 변조되고 캐릭터 이미지만 보여요.",
  VOICE: "이제 진짜 목소리가 들려요. 얼굴은 아직 가려져 있어요.",
  FACE: "카메라가 켜지고 얼굴이 공개돼요.",
};

/** Per-stage "N라운드" announcement copy, shown on the stage_intro screen. */
const STAGE_INTRO: Record<SpeedDateStage, { label: string; hint: string }> = {
  DISGUISED: { label: "가면 대화", hint: "목소리는 변조되고 캐릭터로 만나요." },
  VOICE: { label: "목소리 공개", hint: "이제 진짜 목소리가 들려요. 얼굴은 아직 가려져 있어요." },
  FACE: { label: "얼굴 공개", hint: "카메라가 켜지고 얼굴이 공개돼요." },
};

type Insets = ReturnType<typeof useSafeAreaInsets>;

function genderLabel(g: string): string {
  return g === "male" ? "남성" : g === "female" ? "여성" : g;
}

export default function SpeedDateSession() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuthStore((s) => s.token);

  const [snapshot, setSnapshot] = useState<SpeedDateSnapshot | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [leaveAsk, setLeaveAsk] = useState(false);
  const socketRef = useRef<ReturnType<typeof openSpeedDateSocket> | null>(null);
  const navigation = useNavigation();
  const liveRef = useRef(false);

  // 진행 중(ended 전)에는 뒤로가기(하드웨어 백 포함)를 확인 다이얼로그로 가드 — 실수 이탈 방지.
  // native-stack은 하드웨어 백을 네이티브에서 pop하므로 BackHandler가 아니라 beforeRemove로 막는다.
  liveRef.current = !!snapshot && snapshot.phase !== "ended" && !notFound;
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      if (!liveRef.current) return;
      e.preventDefault();
      setLeaveAsk(true);
    });
    return unsub;
  }, [navigation]);

  // display-only clock (server-authoritative phaseEndsAt drives the real timing)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!token || !id) return;
    const socket = openSpeedDateSocket(token, {
      onSnapshot: (e) => {
        if (e.sessionId !== id) return;
        if (e.snapshot === null) setNotFound(true);
        else setSnapshot(e.snapshot);
      },
      onError: (err) => setError((err as { message?: string })?.message ?? "오류가 발생했어요"),
      onReconnect: () => socketRef.current?.sync(id),
    });
    socketRef.current = socket;
    socket.join(id);
    socket.sync(id);
    return () => {
      socket.leave(id);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, id]);

  // My own outgoing voice is disguised whenever the current stage is DISGUISED. The stage's voiceMod
  // is symmetric within a pairing, so partner.voiceMod is my modulation flag too.
  const media = useSpeedDateMedia(
    snapshot?.room ?? null,
    snapshot?.room?.publishVideo ?? false,
    snapshot?.partner?.voiceMod ?? false,
  );
  const remainSec = snapshot ? Math.max(0, Math.ceil((snapshot.phaseEndsAt - now) / 1000)) : 0;

  const chosen = useMemo(() => new Set(snapshot?.myChoices ?? []), [snapshot?.myChoices]);

  // Final decision is single-pick: choosing one target clears any previous pick.
  function pickOne(targetId: string) {
    const socket = socketRef.current;
    if (!socket || !id) return;
    hapticSelect();
    const wasSelected = chosen.has(targetId);
    for (const cid of chosen) if (cid !== targetId) socket.choose(id, cid, false);
    socket.choose(id, targetId, !wasSelected);
  }

  if (notFound) {
    return (
      <Screen insets={insets}>
        <View style={styles.center}>
          <Text style={styles.msg}>세션을 찾을 수 없어요.</Text>
          <DoodleButton title="홈으로" onPress={() => router.replace("/home")} tone="dark" />
        </View>
      </Screen>
    );
  }
  if (!snapshot) {
    return (
      <Screen insets={insets}>
        <View style={styles.center}>
          <ActivityIndicator color={dark.accent} />
          <Text style={styles.sub}>{error ?? "연결 중이에요…"}</Text>
        </View>
      </Screen>
    );
  }

  const leaveDialog = (
    <ConfirmDialog
      dark
      visible={leaveAsk}
      title="소개팅에서 나갈까요?"
      body="지금 나가면 이번 로테이션과 선택 기회를 놓쳐요. 세션이 끝나기 전에는 언제든 다시 돌아올 수 있어요."
      confirmLabel="나가기"
      destructive
      onConfirm={() => {
        // beforeRemove 가드가 이 이탈까지 막지 않도록 먼저 내린다.
        liveRef.current = false;
        setLeaveAsk(false);
        router.replace("/home");
      }}
      onCancel={() => setLeaveAsk(false)}
    />
  );

  // Round = full-bleed video call. No header/back button — you can't leave mid-session.
  if (snapshot.phase === "round" && snapshot.partner && snapshot.stage) {
    return (
      <View style={styles.fullScreen}>
        <RoundView
          stage={snapshot.stage}
          partner={snapshot.partner}
          roundIndex={snapshot.roundIndex}
          roundCount={snapshot.roundCount}
          seconds={remainSec}
          hasRemoteVideo={media.hasRemoteVideo}
          remoteTrack={media.remoteVideoTrack}
          insets={insets}
        />
        {media.localVideoTrack ? (
          <View style={[styles.selfView, { bottom: insets.bottom + 120 }]}>
            <VideoView track={media.localVideoTrack} mirror />
            <Text style={styles.selfLabel}>나</Text>
          </View>
        ) : null}
        {leaveDialog}
      </View>
    );
  }

  // Stage intro = full-bleed "N라운드" announcement + countdown, shown to everyone before each stage.
  if (snapshot.phase === "stage_intro" && snapshot.stage) {
    return (
      <View style={styles.introScreen}>
        <StageIntroView
          stageIndex={snapshot.stageIndex}
          stageCount={snapshot.stageCount}
          stage={snapshot.stage}
          seconds={remainSec}
          insets={insets}
        />
        {leaveDialog}
      </View>
    );
  }

  return (
    <Screen insets={insets}>
      <ScrollView contentContainerStyle={styles.content}>
        {snapshot.phase === "preflight" ? (
          <Waiting title="곧 시작해요" sub="6명이 모두 준비되면 첫 대화가 열려요." seconds={remainSec} />
        ) : null}

        {snapshot.phase === "intermission" ? (
          <Waiting title="다음 상대와 연결 중…" sub="잠시만 기다려 주세요." seconds={remainSec} />
        ) : null}

        {snapshot.phase === "decision" ? (
          <DecisionView
            partners={snapshot.metPartners}
            chosen={chosen}
            seconds={remainSec}
            onPick={pickOne}
          />
        ) : null}

        {snapshot.phase === "ended" ? <ResultView result={snapshot.result} /> : null}
      </ScrollView>
      {leaveDialog}
    </Screen>
  );
}

function Screen({ insets, children }: { insets: Insets; children: React.ReactNode }) {
  return <View style={[styles.screen, { paddingTop: insets.top }]}>{children}</View>;
}

function Waiting({ title, sub, seconds }: { title: string; sub: string; seconds: number }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={dark.accent} size="large" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
      <Text style={styles.timer}>{seconds}s</Text>
    </View>
  );
}

function StageIntroView({
  stageIndex,
  stageCount,
  stage,
  seconds,
  insets,
}: {
  stageIndex: number;
  stageCount: number;
  stage: SpeedDateStage;
  seconds: number;
  insets: Insets;
}) {
  const info = STAGE_INTRO[stage];
  return (
    <View style={[styles.intro, { paddingTop: insets.top + space.x6, paddingBottom: insets.bottom + space.x6 }]}>
      <View style={styles.introTop}>
        <Text style={styles.introKicker}>
          ROUND {stageIndex + 1} / {stageCount}
        </Text>
        <Text style={styles.introRound}>{stageIndex + 1}라운드</Text>
        <Text style={styles.introLabel}>{info.label}</Text>
        <Text style={styles.introHint}>{info.hint}</Text>
      </View>
      <View style={styles.introBottom}>
        <Text style={styles.introCount}>{seconds}</Text>
        <Text style={styles.introSub}>잠시 후 시작해요</Text>
      </View>
    </View>
  );
}

function RoundView({
  stage,
  partner,
  roundIndex,
  roundCount,
  seconds,
  hasRemoteVideo,
  remoteTrack,
  insets,
}: {
  stage: SpeedDateStage;
  partner: PartnerView;
  roundIndex: number;
  roundCount: number;
  seconds: number;
  hasRemoteVideo: boolean;
  remoteTrack: unknown | null;
  insets: Insets;
}) {
  return (
    <View style={styles.stageFull}>
      {hasRemoteVideo ? (
        <View style={StyleSheet.absoluteFill}>
          <VideoView track={remoteTrack} />
        </View>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.avatarStage]}>
          <SpeedDateAvatar avatarId={partner.avatarId} nickname={partner.nickname} size={220} />
        </View>
      )}

      {/* Top overlay: round · timer (media is app-controlled per stage — no user toggles) */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + space.x2 }]}>
        <View style={styles.topRight}>
          <Text style={styles.overlayMeta}>
            라운드 {roundIndex + 1}/{roundCount}
          </Text>
          <View style={styles.timerPill}>
            <Text style={styles.timerPillText}>{seconds}s</Text>
          </View>
        </View>
      </View>

      {/* 하단 1/3 지점: 추천 질문(랜덤 30개, crossfade) — 어색한 침묵 깨기 */}
      <SuggestedQuestion />

      {/* Bottom overlay: nickname · badges · stage hint */}
      <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + space.x4 }]}>
        <Text style={styles.overlayNick}>{partner.nickname}</Text>
        <View style={styles.badgeRow}>
          <DoodleChip label={genderLabel(partner.gender)} tiny />
          <View style={styles.badge}>
            {partner.voiceMod ? (
              <MicOff color={colors.onAccent} size={14} />
            ) : (
              <Mic color={colors.onAccent} size={14} />
            )}
            <Text style={styles.overlayBadgeText}>{partner.voiceMod ? "음성 변조" : "실제 목소리"}</Text>
          </View>
        </View>
        <Text style={styles.overlayHint}>{STAGE_HINT[stage]}</Text>
      </View>
    </View>
  );
}

function DecisionView({
  partners,
  chosen,
  seconds,
  onPick,
}: {
  partners: PartnerView[];
  chosen: Set<string>;
  seconds: number;
  onPick: (id: string) => void;
}) {
  return (
    <View style={styles.roundWrap}>
      <Text style={styles.title}>가장 마음에 든 한 명은?</Text>
      <Text style={styles.sub}>
        한 명만 고를 수 있어요. 시간이 끝나면 지금 선택이 제출돼요. 선택은 비공개예요.
      </Text>
      <Text style={styles.timer}>{seconds}s</Text>
      <View style={styles.grid}>
        {partners.map((p) => {
          const on = chosen.has(p.profileId);
          return (
            <DoodleCard
              key={p.profileId}
              tone="dark"
              style={[styles.gridCard, on ? styles.gridCardOn : null]}
              contentStyle={styles.gridInner}
            >
              <SpeedDateAvatar avatarId={p.avatarId} nickname={p.nickname} size={72} />
              <Text style={styles.gridNick} numberOfLines={1}>
                {p.nickname}
              </Text>
              <DoodleButton
                title={on ? "선택됨 ✓" : "선택"}
                onPress={() => onPick(p.profileId)}
                variant={on ? "primary" : "secondary"}
                tone="dark"
              />
            </DoodleCard>
          );
        })}
      </View>
    </View>
  );
}

function ResultView({ result }: { result: SpeedDateSnapshot["result"] }) {
  const matches = result?.matches ?? [];
  if (matches.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>이번엔 서로 선택이 없었어요</Text>
        <Text style={styles.sub}>다음 만남에서 더 잘 맞는 상대를 찾아볼게요.</Text>
        <DoodleButton title="홈으로" onPress={() => router.replace("/home")} variant="primary" tone="dark" />
      </View>
    );
  }
  return (
    <View style={styles.roundWrap}>
      <Text style={styles.title}>{matches.length}명과 매칭됐어요!</Text>
      <Text style={styles.sub}>이제 서로의 프로필을 보며 1:1 채팅을 이어가세요.</Text>
      {matches.map((m) => (
        <DoodleCard key={m.roomId} tone="dark" style={styles.matchCard} contentStyle={styles.matchInner}>
          <Text style={styles.nickname}>{m.nickname}</Text>
          <DoodleButton
            title="채팅 시작"
            variant="primary"
            tone="dark"
            onPress={() => router.replace({ pathname: "/(app)/chat/[roomId]", params: { roomId: m.roomId } })}
          />
        </DoodleCard>
      ))}
      <DoodleButton title="홈으로" onPress={() => router.replace("/home")} tone="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg },
  fullScreen: { flex: 1, backgroundColor: "#000" },
  stageFull: { flex: 1, backgroundColor: "#000" },
  avatarStage: { alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  // Stage intro ("N라운드" announcement)
  introScreen: { flex: 1, backgroundColor: dark.bg },
  intro: { flex: 1, justifyContent: "space-between", alignItems: "center", paddingHorizontal: space.x6 },
  introTop: { alignItems: "center", gap: space.x2, marginTop: "auto" },
  introKicker: { ...type.label, color: dark.label, letterSpacing: 2 },
  introRound: { fontFamily: serifFont, fontSize: 44, lineHeight: 52, color: dark.heading, textAlign: "center" },
  introLabel: { ...type.title, color: dark.text, textAlign: "center", marginTop: space.x1 },
  introHint: { ...type.body, color: dark.textMuted, textAlign: "center", maxWidth: 320 },
  introBottom: { alignItems: "center", gap: space.x1, marginTop: "auto" },
  introCount: { fontFamily: serifFont, fontSize: 64, lineHeight: 72, color: dark.accent },
  introSub: { ...type.caption, color: dark.textMuted },
  content: {
    flexGrow: 1,
    padding: layout.screenGutter,
    gap: space.x4,
    maxWidth: layout.contentMax,
    width: "100%",
    alignSelf: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.x3, padding: space.x6 },
  roundWrap: { gap: space.x4, alignItems: "stretch" },
  // Full-bleed round overlays
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.x2,
    paddingHorizontal: layout.screenGutter,
    paddingBottom: space.x3,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  overlayMeta: { ...type.label, color: colors.onAccent },
  timerPill: {
    backgroundColor: colors.accentStrong,
    borderRadius: 999,
    paddingHorizontal: space.x3,
    paddingVertical: 4,
  },
  timerPillText: { ...type.label, color: colors.onAccent },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: space.x2,
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.x4,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overlayNick: { ...type.title, color: colors.onAccent },
  overlayBadgeText: { ...type.caption, color: colors.onAccent },
  overlayHint: { ...type.caption, color: colors.onAccent, textAlign: "center", opacity: 0.85 },
  selfView: {
    position: "absolute",
    right: 16,
    width: 104,
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 2,
    borderColor: colors.onAccent,
  },
  selfLabel: {
    position: "absolute",
    bottom: 4,
    left: 6,
    ...type.caption,
    color: colors.onAccent,
  },
  nickname: { ...type.title, color: dark.heading },
  badgeRow: { flexDirection: "row", gap: space.x2, flexWrap: "wrap", justifyContent: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4 },
  timer: { ...type.title, color: dark.accent },
  title: { ...type.title, color: dark.heading, textAlign: "center" },
  sub: { ...type.body, color: dark.textMuted, textAlign: "center" },
  msg: { ...type.heading, color: dark.heading, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.x3, justifyContent: "center" },
  gridCard: { width: 150 },
  gridCardOn: { borderColor: dark.accent },
  gridInner: { alignItems: "center", gap: space.x2, paddingVertical: space.x3 },
  gridNick: { ...type.label, color: dark.text, maxWidth: 130 },
  matchCard: { width: "100%" },
  matchInner: { alignItems: "center", gap: space.x3, paddingVertical: space.x4 },
});
