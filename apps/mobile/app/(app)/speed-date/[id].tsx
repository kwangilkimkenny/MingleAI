import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import {
  Camera,
  CameraOff,
  Check,
  ChevronRight,
  LogOut,
  Mic,
  MicOff,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import type { SpeedDateSnapshot, SpeedDateStage, PartnerView } from "@mingle/client-core";
import { DoodleButton } from "../../../src/components/Doodle";
import { DoodleChip } from "../../../src/components/DoodleSvg";
import { SpeedDateAvatar } from "../../../src/components/speed-date/SpeedDateAvatar";
import { SuggestedQuestion } from "../../../src/components/speed-date/SuggestedQuestion";
import { openSpeedDateSocket } from "../../../src/lib/speed-date-socket";
import { useSpeedDateMedia } from "../../../src/lib/speed-date-media";
import { requestCamera } from "../../../src/lib/permissions";
import { VideoView } from "../../../src/components/speed-date/VideoView";
import { PeerModerationMenu } from "../../../src/components/PeerModerationMenu";
import { useAuthStore } from "../../../src/lib/client";
import { hapticSelect } from "../../../src/lib/haptics";
import { serifFont } from "../../../src/lib/serif";
import { ConfirmDialog } from "../../../src/components/Foundation";
import { colors, dark, layout, space, type } from "../../../src/lib/theme";
import {
  speedDateConnectionCopy,
  speedDateFaceFallbackCopy,
  speedDateProgressCopy,
} from "../../../src/lib/speed-date-presentation";

const STAGE_HINT: Record<SpeedDateStage, string> = {
  DISGUISED: "목소리는 변조되고 캐릭터 이미지만 보여요.",
  VOICE: "이제 진짜 목소리가 들려요. 얼굴은 아직 가려져 있어요.",
  FACE: "카메라가 켜지고 얼굴이 공개돼요.",
};

/** Per-stage announcement copy; stages and partner conversations are deliberately named separately. */
const STAGE_INTRO: Record<SpeedDateStage, { label: string; hint: string }> = {
  DISGUISED: { label: "가면 대화", hint: "목소리는 변조되고 캐릭터로 만나요." },
  VOICE: { label: "목소리 공개", hint: "이제 진짜 목소리가 들려요. 얼굴은 아직 가려져 있어요." },
  FACE: { label: "얼굴 공개", hint: "카메라가 켜지고 얼굴이 공개돼요." },
};

type Insets = ReturnType<typeof useSafeAreaInsets>;

/** 게이트웨이는 내부 코드("forbidden" 등)를 보낸다 — 화면에는 한국어만 노출한다. */
function errorCopy(raw?: string): string {
  if (raw === "forbidden") return "이 소개팅에 참여할 수 없어요.";
  if (raw === "rate-limited") return "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.";
  if (raw && /[가-힣]/.test(raw)) return raw;
  return "연결에 문제가 생겼어요.";
}

function genderLabel(g: string): string {
  return g === "male" ? "남성" : g === "female" ? "여성" : g;
}

/** 받침 유무로 "와/과" 선택 — "달빛 펭귄과", "숲속 수달과", "구름 나비와". */
function withParticle(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${word}와`;
  return (code - 0xac00) % 28 === 0 ? `${word}와` : `${word}과`;
}

export default function SpeedDateSession() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuthStore((s) => s.token);

  const [snapshot, setSnapshot] = useState<SpeedDateSnapshot | null>(null);
  // 스냅샷을 받은 기기 시각 — 서버 시각과 비교해 시계 오차를 보정한다.
  const [snapshotAt, setSnapshotAt] = useState(() => Date.now());
  // 스냅샷이 오래 안 오면(세션이 그새 끝났거나 소켓이 막힘) 빠져나갈 길을 준다 — 무한 "연결 중" 방지.
  const [stalled, setStalled] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [leaveAsk, setLeaveAsk] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<{
    targetId: string | null;
    nickname: string;
  } | null>(null);
  const socketRef = useRef<ReturnType<typeof openSpeedDateSocket> | null>(null);
  const navigation = useNavigation();
  const liveRef = useRef(false);
  // "나가기" 확정 플래그 — 렌더마다 재계산되는 liveRef와 달리 한 번 서면 유지된다.
  // (onConfirm에서 liveRef만 내리면 setLeaveAsk 리렌더가 아래 대입으로 즉시 복원해
  //  beforeRemove가 replace를 다시 막는 레이스가 있었다 — QA 2026-07-27.)
  const leavingRef = useRef(false);

  // 진행 중(ended 전)에는 뒤로가기(하드웨어 백 포함)를 확인 다이얼로그로 가드 — 실수 이탈 방지.
  // native-stack은 하드웨어 백을 네이티브에서 pop하므로 BackHandler가 아니라 beforeRemove로 막는다.
  liveRef.current =
    !leavingRef.current && !!snapshot && snapshot.phase !== "ended" && !notFound;
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      if (!liveRef.current) return;
      e.preventDefault();
      setLeaveAsk(true);
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    if (snapshot) return;
    const t = setTimeout(() => setStalled(true), 8000);
    return () => clearTimeout(t);
  }, [snapshot]);

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
        else {
          setSnapshotAt(Date.now());
          setSnapshot(e.snapshot);
          setStalled(false);
        }
      },
      onError: (err) => setError(errorCopy((err as { message?: string })?.message)),
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

  // 얼굴 공개 단계에 들어갈 때 처음으로 카메라를 요청한다 — 진입 게이트는 마이크만 받는다
  // (카메라를 미리 요구하면 가면·목소리 단계도 못 해보고 이탈, 2026-08-11 QA).
  // 거부해도 세션은 계속된다: 발행만 안 될 뿐 상대 영상은 보인다.
  const cameraAsked = useRef(false);
  useEffect(() => {
    if (!snapshot?.room?.publishVideo || cameraAsked.current) return;
    cameraAsked.current = true;
    void requestCamera();
  }, [snapshot?.room?.publishVideo]);

  // My own outgoing voice is disguised whenever the current stage is DISGUISED. The stage's voiceMod
  // is symmetric within a pairing, so partner.voiceMod is my modulation flag too.
  const media = useSpeedDateMedia(
    snapshot?.room ?? null,
    snapshot?.room?.publishVideo ?? false,
    snapshot?.partner?.voiceMod ?? false,
  );
  // 기기 시계가 서버와 어긋나면 카운트다운이 통째로 틀어진다(에뮬레이터에서 10초 이상 관측).
  // 스냅샷마다 서버 시각을 받아 오프셋을 잡고, 그 보정된 '지금'으로 남은 시간을 센다.
  const skew = snapshot ? snapshot.serverNow - snapshotAt : 0;
  const remainSec = snapshot
    ? Math.max(0, Math.ceil((snapshot.phaseEndsAt - (now + skew)) / 1000))
    : 0;

  const chosen = useMemo(() => new Set(snapshot?.myChoices ?? []), [snapshot?.myChoices]);

  function requestChoice(targetId: string) {
    const partner = snapshot?.metPartners.find((candidate) => candidate.profileId === targetId);
    if (!partner || chosen.has(targetId)) return;
    hapticSelect();
    setPendingChoice({ targetId, nickname: partner.nickname });
  }

  function requestChoiceClear() {
    const targetId = chosen.values().next().value as string | undefined;
    const partner = snapshot?.metPartners.find((candidate) => candidate.profileId === targetId);
    if (!targetId || !partner) return;
    hapticSelect();
    setPendingChoice({ targetId: null, nickname: partner.nickname });
  }

  function confirmChoice() {
    const socket = socketRef.current;
    const pending = pendingChoice;
    if (!socket || !id || !pending) return;
    if (pending.targetId) socket.choose(id, pending.targetId, true);
    else {
      const currentId = chosen.values().next().value as string | undefined;
      if (currentId) socket.choose(id, currentId, false);
    }
    setPendingChoice(null);
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
          {stalled ? (
            <>
              <Text style={styles.sub}>연결이 오래 걸려요. 잠시 후 다시 시도해 주세요.</Text>
              <DoodleButton title="홈으로" onPress={() => router.replace("/home")} tone="dark" />
            </>
          ) : null}
        </View>
      </Screen>
    );
  }

  function permitNavigation() {
    leavingRef.current = true;
    liveRef.current = false;
  }

  function leaveForHome() {
    permitNavigation();
    setLeaveAsk(false);
    router.replace("/home");
  }

  function reportPartner(peer: { profileId: string }) {
    permitNavigation();
    router.push({
      pathname: "/(app)/report/[profileId]" as never,
      params: { profileId: peer.profileId },
    });
  }

  const leaveDialog = (
    <ConfirmDialog
      dark
      visible={leaveAsk}
      title="소개팅에서 나갈까요?"
      body="지금 나가면 이번 로테이션과 선택 기회를 놓쳐요. 세션이 끝나기 전에는 언제든 다시 돌아올 수 있어요."
      confirmLabel="나가기"
      destructive
      onConfirm={leaveForHome}
      onCancel={() => setLeaveAsk(false)}
    />
  );

  // Round = full-bleed video call with persistent media and safety controls.
  if (snapshot.phase === "round" && snapshot.partner && snapshot.stage) {
    return (
      <View style={styles.fullScreen}>
        <RoundView
          stage={snapshot.stage}
          stageIndex={snapshot.stageIndex}
          stageCount={snapshot.stageCount}
          partner={snapshot.partner}
          roundIndex={snapshot.roundIndex}
          roundCount={snapshot.roundCount}
          seconds={remainSec}
          hasRemoteVideo={media.hasRemoteVideo}
          remoteTrack={media.remoteVideoTrack}
          mediaStatus={media.status}
          microphoneEnabled={media.microphoneEnabled}
          cameraEnabled={media.cameraEnabled}
          canToggleMicrophone={media.canToggleMicrophone}
          canToggleCamera={media.canToggleCamera}
          onToggleMicrophone={() => void media.setMicrophoneEnabled(!media.microphoneEnabled)}
          onToggleCamera={() => void media.setCameraEnabled(!media.cameraEnabled)}
          onLeave={() => setLeaveAsk(true)}
          onReport={reportPartner}
          onBlocked={leaveForHome}
          insets={insets}
        />
        {media.localVideoTrack ? (
          <View style={[styles.selfView, { bottom: insets.bottom + 210 }]}>
            <VideoView track={media.localVideoTrack} mirror />
            <Text style={styles.selfLabel}>나</Text>
          </View>
        ) : null}
        {leaveDialog}
      </View>
    );
  }

  // Stage intro = full-bleed stage announcement + countdown, shown to everyone before each stage.
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

  // 결정·결과는 전용 전체화면 레이아웃(헤드 위 · 선택지 가운데 · 액션 아래) — 스크롤 카드 나열 폐기.
  if (snapshot.phase === "decision") {
    const replacing = chosen.size > 0 && pendingChoice?.targetId !== null;
    return (
      <View style={styles.screen}>
        <DecisionView
          partners={snapshot.metPartners}
          chosen={chosen}
          seconds={remainSec}
          onPick={requestChoice}
          onClear={requestChoiceClear}
          insets={insets}
        />
        <ConfirmDialog
          dark
          visible={pendingChoice !== null}
          title={
            pendingChoice?.targetId === null
              ? "제출한 선택을 취소할까요?"
              : `${pendingChoice?.nickname ?? "이 상대"}님을 선택할까요?`
          }
          body={
            pendingChoice?.targetId === null
              ? "결정 시간이 끝나기 전에는 다시 선택할 수 있어요."
              : replacing
                ? "확인하면 기존 선택 대신 이 상대가 제출돼요. 결정 시간이 끝나기 전에는 다시 바꿀 수 있어요."
                : "확인해야 선택이 제출돼요. 결정 시간이 끝나기 전에는 다시 바꿀 수 있어요."
          }
          confirmLabel={pendingChoice?.targetId === null ? "선택 취소" : "선택 확정"}
          onConfirm={confirmChoice}
          onCancel={() => setPendingChoice(null)}
        />
        {leaveDialog}
      </View>
    );
  }

  if (snapshot.phase === "ended") {
    return (
      <View style={styles.screen}>
        <ResultView result={snapshot.result} partners={snapshot.metPartners} insets={insets} />
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
          STAGE {stageIndex + 1} / {stageCount}
        </Text>
        <Text style={styles.introRound}>{stageIndex + 1}/{stageCount} 단계</Text>
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
  stageIndex,
  stageCount,
  partner,
  roundIndex,
  roundCount,
  seconds,
  hasRemoteVideo,
  remoteTrack,
  mediaStatus,
  microphoneEnabled,
  cameraEnabled,
  canToggleMicrophone,
  canToggleCamera,
  onToggleMicrophone,
  onToggleCamera,
  onLeave,
  onReport,
  onBlocked,
  insets,
}: {
  stage: SpeedDateStage;
  stageIndex: number;
  stageCount: number;
  partner: PartnerView;
  roundIndex: number;
  roundCount: number;
  seconds: number;
  hasRemoteVideo: boolean;
  remoteTrack: unknown | null;
  mediaStatus: "idle" | "connecting" | "connected" | "unavailable";
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  canToggleMicrophone: boolean;
  canToggleCamera: boolean;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
  onReport: (peer: { profileId: string; name: string }) => void;
  onBlocked: () => void;
  insets: Insets;
}) {
  const connected = mediaStatus === "connected";
  const progress = speedDateProgressCopy({ stageIndex, stageCount, roundIndex, roundCount });
  return (
    <View style={styles.stageFull}>
      {hasRemoteVideo ? (
        <View style={StyleSheet.absoluteFill}>
          <VideoView track={remoteTrack} />
        </View>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.avatarStage]}>
          <SpeedDateAvatar avatarId={partner.avatarId} nickname={partner.nickname} size={220} />
          {stage === "FACE" ? (
            <View style={styles.faceFallback} accessibilityLiveRegion="polite">
              <CameraOff color={colors.onAccent} size={18} />
              <Text style={styles.faceFallbackText}>{speedDateFaceFallbackCopy(mediaStatus)}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Top overlay: overall progress, connection state, timer. */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + space.x2 }]}>
        <View style={[styles.connectionPill, !connected && styles.connectionPillWarn]}>
          {connected ? (
            <Wifi color={colors.onAccent} size={15} />
          ) : (
            <WifiOff color={colors.onAccent} size={15} />
          )}
          <Text style={styles.connectionText}>{speedDateConnectionCopy(mediaStatus)}</Text>
        </View>
        <View style={styles.topRight}>
          <Text style={styles.overlayMeta}>{progress}</Text>
          <View style={styles.timerPill}>
            <Text style={styles.timerPillText}>{seconds}s</Text>
          </View>
        </View>
      </View>

      {/* 하단 1/3 지점: 추천 질문(랜덤 30개, crossfade) — 어색한 침묵 깨기 */}
      <SuggestedQuestion />

      {/* Bottom overlay: identity, current reveal state, persistent controls. */}
      <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + space.x3 }]}>
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
        <View style={styles.controlDock} accessibilityLabel="통화 및 안전 제어">
          <RoundControl
            label={
              canToggleMicrophone
                ? microphoneEnabled
                  ? "음소거"
                  : "음소거 해제"
                : "음성 보호 중"
            }
            disabled={!canToggleMicrophone}
            active={!microphoneEnabled}
            onPress={onToggleMicrophone}
            icon={
              microphoneEnabled ? (
                <Mic color={colors.onAccent} size={21} />
              ) : (
                <MicOff color={colors.onAccent} size={21} />
              )
            }
          />
          <RoundControl
            label={canToggleCamera ? (cameraEnabled ? "카메라 끄기" : "카메라 켜기") : "얼굴 공개 때"}
            disabled={!canToggleCamera}
            active={canToggleCamera && !cameraEnabled}
            onPress={onToggleCamera}
            icon={
              cameraEnabled ? (
                <Camera color={colors.onAccent} size={21} />
              ) : (
                <CameraOff color={colors.onAccent} size={21} />
              )
            }
          />
          <View style={styles.controlItem}>
            <View style={styles.safetyButton}>
              <PeerModerationMenu
                peer={{ profileId: partner.profileId, name: partner.nickname }}
                onReport={onReport}
                onBlocked={onBlocked}
                dark
              />
            </View>
            <Text style={styles.controlLabel}>안전</Text>
          </View>
          <RoundControl
            label="나가기"
            danger
            onPress={onLeave}
            icon={<LogOut color={dark.danger} size={21} />}
          />
        </View>
      </View>
    </View>
  );
}

function RoundControl({
  label,
  icon,
  onPress,
  active = false,
  disabled = false,
  danger = false,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlItem,
        disabled && styles.controlDisabled,
        pressed && styles.controlPressed,
      ]}
    >
      <View
        style={[
          styles.controlButton,
          active && styles.controlButtonActive,
          danger && styles.controlButtonDanger,
        ]}
      >
        {icon}
      </View>
      <Text style={[styles.controlLabel, danger && styles.controlLabelDanger]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * 결정 화면 — 만난 순서대로 놓인 전폭 행에서 한 명을 고른다. 카드 그리드(2+1 홀로 남는 배치)와
 * 행마다 있던 '선택' 버튼을 걷어내고, 행 자체가 탭 타깃이다. 남은 시간은 상단 우측 큰 숫자.
 */
function DecisionView({
  partners,
  chosen,
  seconds,
  onPick,
  onClear,
  insets,
}: {
  partners: PartnerView[];
  chosen: Set<string>;
  seconds: number;
  onPick: (id: string) => void;
  onClear: () => void;
  insets: Insets;
}) {
  const pickedId = partners.find((p) => chosen.has(p.profileId))?.profileId ?? null;
  const pickedNick = partners.find((p) => p.profileId === pickedId)?.nickname ?? "";
  const urgent = seconds <= 5;

  return (
    <View
      style={[
        styles.decision,
        { paddingTop: insets.top + space.x6, paddingBottom: insets.bottom + space.x5 },
      ]}
    >
      <View style={styles.decisionHead}>
        <View style={styles.decisionHeadText}>
          <Text style={styles.decisionKicker}>비공개 선택</Text>
          <Text style={styles.decisionTitle}>가장 마음에 든{"\n"}한 명</Text>
        </View>
        <Text style={[styles.decisionClock, urgent && styles.decisionClockUrgent]}>{seconds}</Text>
      </View>

      <View style={styles.decisionList}>
        {partners.map((p, i) => {
          const on = chosen.has(p.profileId);
          return (
            <Pressable
              key={p.profileId}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${p.nickname}${on ? ", 선택됨" : ""}`}
              onPress={() => onPick(p.profileId)}
              style={({ pressed }) => [
                styles.pickRow,
                on && styles.pickRowOn,
                pressed && styles.pickRowPressed,
              ]}
            >
              <SpeedDateAvatar avatarId={p.avatarId} nickname={p.nickname} size={56} />
              <View style={styles.pickText}>
                <Text style={styles.pickNick} numberOfLines={1}>
                  {p.nickname}
                </Text>
                <Text style={styles.pickMeta}>{i + 1}번째로 만난 상대</Text>
              </View>
              <View style={[styles.pickMark, on && styles.pickMarkOn]}>
                {on ? <Check color={dark.bg} size={18} strokeWidth={2.5} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.decisionFootArea}>
        <Text style={styles.decisionFoot}>
          {pickedId
            ? `${pickedNick} 선택 완료 · 결정 전까지 변경할 수 있어요`
            : "상대를 고른 뒤 확인해야 제출돼요 · 선택은 비공개예요"}
        </Text>
        {pickedId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${pickedNick} 선택 취소`}
            onPress={onClear}
            style={({ pressed }) => [styles.choiceUndo, pressed && styles.pickRowPressed]}
          >
            <Text style={styles.choiceUndoText}>제출한 선택 취소</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * 결과 화면 — 성공은 상대 아바타를 크게 세운 히어로 + 하단 고정 CTA, 실패는 같은 골격에
 * 재도전 액션. 이전 버전은 카드 안에 버튼을 넣어 화면 위쪽에만 몰려 있었다.
 */
function ResultView({
  result,
  partners,
  insets,
}: {
  result: SpeedDateSnapshot["result"];
  partners: PartnerView[];
  insets: Insets;
}) {
  const matches = result?.matches ?? [];
  const avatarOf = (profileId: string) =>
    partners.find((p) => p.profileId === profileId)?.avatarId ?? "av-coral";
  const pad = {
    paddingTop: insets.top + space.x6,
    paddingBottom: insets.bottom + space.x5,
  };

  if (matches.length === 0) {
    return (
      <View style={[styles.result, pad]}>
        <View style={styles.resultHero}>
          <Text style={styles.resultKicker}>오늘의 로테이션</Text>
          <Text style={styles.resultTitle}>이번엔{"\n"}서로 선택이 없었어요</Text>
          <Text style={styles.resultSub}>다음 자리에서 더 잘 맞는 상대를 찾아볼게요.</Text>
        </View>
        <View style={styles.resultDock}>
          <DoodleButton
            title="다시 매칭하기"
            variant="primary"
            tone="dark"
            onPress={() => router.replace("/(app)/speed-date")}
          />
          <DoodleButton title="홈으로" tone="dark" onPress={() => router.replace("/home")} />
        </View>
      </View>
    );
  }

  const single = matches.length === 1 ? matches[0] : null;

  return (
    <View style={[styles.result, pad]}>
      <View style={styles.resultHero}>
        <Text style={styles.resultKicker}>서로를 골랐어요</Text>
        {single ? (
          <>
            <SpeedDateAvatar avatarId={avatarOf(single.profileId)} nickname={single.nickname} size={132} />
            <Text style={styles.resultTitle}>{withParticle(single.nickname)}{"\n"}이어졌어요</Text>
          </>
        ) : (
          <Text style={styles.resultTitle}>{matches.length}명과{"\n"}이어졌어요</Text>
        )}
        <Text style={styles.resultSub}>1:1 채팅이 열렸어요. 먼저 인사를 건네 보세요.</Text>
      </View>

      {single ? null : (
        <View style={styles.decisionList}>
          {matches.map((m) => (
            <Pressable
              key={m.roomId}
              accessibilityRole="button"
              accessibilityLabel={`${m.nickname}와 채팅 시작`}
              onPress={() =>
                router.replace({ pathname: "/(app)/chat/[roomId]", params: { roomId: m.roomId } })
              }
              style={({ pressed }) => [styles.pickRow, pressed && styles.pickRowPressed]}
            >
              <SpeedDateAvatar avatarId={avatarOf(m.profileId)} nickname={m.nickname} size={56} />
              <View style={styles.pickText}>
                <Text style={styles.pickNick} numberOfLines={1}>
                  {m.nickname}
                </Text>
                <Text style={styles.pickMeta}>채팅 시작</Text>
              </View>
              <ChevronRight color={dark.textMuted} size={20} strokeWidth={1.75} />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.resultDock}>
        {single ? (
          <DoodleButton
            title="채팅 시작"
            variant="primary"
            tone="dark"
            onPress={() =>
              router.replace({ pathname: "/(app)/chat/[roomId]", params: { roomId: single.roomId } })
            }
          />
        ) : null}
        <DoodleButton title="홈으로" tone="dark" onPress={() => router.replace("/home")} />
      </View>
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
    justifyContent: "space-between",
    gap: space.x2,
    paddingHorizontal: layout.screenGutter,
    paddingBottom: space.x3,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  connectionPill: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: space.x2,
    borderRadius: 999,
    backgroundColor: "rgba(37,122,85,0.88)",
  },
  connectionPillWarn: { backgroundColor: "rgba(123,37,49,0.9)" },
  connectionText: { ...type.caption, color: colors.onAccent, fontSize: 12 },
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
  faceFallback: {
    position: "absolute",
    left: layout.screenGutter,
    right: layout.screenGutter,
    bottom: "48%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.x2,
    paddingHorizontal: space.x3,
    paddingVertical: space.x2,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  faceFallbackText: { ...type.caption, color: colors.onAccent, flexShrink: 1, textAlign: "center" },
  controlDock: {
    width: "100%",
    maxWidth: layout.contentMax,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.x1,
    paddingTop: space.x2,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.18)",
  },
  controlItem: { flex: 1, minWidth: 0, alignItems: "center", gap: 4 },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  controlButtonActive: { backgroundColor: dark.accentFill, borderColor: dark.accent },
  controlButtonDanger: { backgroundColor: dark.dangerFill, borderColor: dark.danger },
  safetyButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  controlLabel: { ...type.caption, color: colors.onAccent, fontSize: 11, lineHeight: 15 },
  controlLabelDanger: { color: dark.danger },
  controlDisabled: { opacity: 0.52 },
  controlPressed: { opacity: 0.7 },
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
  // ── 결정 화면 ──
  decision: { flex: 1, paddingHorizontal: layout.screenGutter, justifyContent: "space-between" },
  decisionHead: { flexDirection: "row", alignItems: "flex-start", gap: space.x4 },
  decisionHeadText: { flex: 1, gap: space.x1 },
  decisionKicker: { ...type.label, color: dark.label, letterSpacing: 1.5 },
  decisionTitle: { fontFamily: serifFont, fontSize: 34, lineHeight: 44, color: dark.heading },
  decisionClock: { fontFamily: serifFont, fontSize: 44, lineHeight: 48, color: dark.textMuted },
  decisionClockUrgent: { color: dark.accent },
  decisionList: { gap: space.x2 },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    minHeight: 84,
    paddingHorizontal: space.x4,
    paddingVertical: space.x3,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
  },
  pickRowOn: { borderColor: dark.text, backgroundColor: dark.surfaceHi },
  pickRowPressed: { opacity: 0.75 },
  pickText: { flex: 1, gap: 2 },
  pickNick: { ...type.title, color: dark.heading },
  pickMeta: { ...type.caption, color: dark.textMuted },
  pickMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dark.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pickMarkOn: { backgroundColor: dark.text, borderColor: dark.text },
  decisionFootArea: { alignItems: "center", gap: space.x2 },
  decisionFoot: { ...type.caption, color: dark.textMuted, textAlign: "center" },
  choiceUndo: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.x4 },
  choiceUndoText: { ...type.label, color: dark.accent, textDecorationLine: "underline" },
  // ── 결과 화면 ──
  result: { flex: 1, paddingHorizontal: layout.screenGutter, justifyContent: "space-between" },
  resultHero: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.x4 },
  resultKicker: { ...type.label, color: dark.label, letterSpacing: 1.5 },
  resultTitle: {
    fontFamily: serifFont,
    fontSize: 34,
    lineHeight: 46,
    color: dark.heading,
    textAlign: "center",
  },
  resultSub: { ...type.body, color: dark.textMuted, textAlign: "center", maxWidth: 300 },
  resultDock: { gap: space.x2, paddingTop: space.x5 },
});
