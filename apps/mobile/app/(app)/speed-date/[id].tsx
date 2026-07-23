import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Mic, MicOff } from "lucide-react-native";
import type { SpeedDateSnapshot, SpeedDateStage, PartnerView } from "@mingle/client-core";
import { DoodleButton, DoodleCard } from "../../../src/components/Doodle";
import { DoodleChip } from "../../../src/components/DoodleSvg";
import { SpeedDateAvatar } from "../../../src/components/speed-date/SpeedDateAvatar";
import { openSpeedDateSocket } from "../../../src/lib/speed-date-socket";
import { useSpeedDateMedia } from "../../../src/lib/speed-date-media";
import { VideoView } from "../../../src/components/speed-date/VideoView";
import { useAuthStore } from "../../../src/lib/client";
import { hapticSelect } from "../../../src/lib/haptics";
import { colors, layout, space, type } from "../../../src/lib/theme";

const STAGE_HINT: Record<SpeedDateStage, string> = {
  DISGUISED: "목소리는 변조되고 캐릭터 이미지만 보여요.",
  VOICE: "이제 진짜 목소리가 들려요. 얼굴은 아직 가림.",
  FACE: "카메라가 켜지고 얼굴이 공개돼요.",
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
  const socketRef = useRef<ReturnType<typeof openSpeedDateSocket> | null>(null);

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

  const media = useSpeedDateMedia(snapshot?.room ?? null, snapshot?.room?.publishVideo ?? false);
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
          <DoodleButton title="홈으로" onPress={() => router.replace("/home")} />
        </View>
      </Screen>
    );
  }
  if (!snapshot) {
    return (
      <Screen insets={insets}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.sub}>{error ?? "연결 중이에요…"}</Text>
        </View>
      </Screen>
    );
  }

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
    </Screen>
  );
}

function Screen({ insets, children }: { insets: Insets; children: React.ReactNode }) {
  return <View style={[styles.screen, { paddingTop: insets.top }]}>{children}</View>;
}

function Waiting({ title, sub, seconds }: { title: string; sub: string; seconds: number }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
      <Text style={styles.timer}>{seconds}s</Text>
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
          <SpeedDateAvatar avatarId={partner.avatarId} size={220} />
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

      {/* Bottom overlay: nickname · badges · stage hint */}
      <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + space.x4 }]}>
        <Text style={styles.overlayNick}>{partner.nickname}</Text>
        <View style={styles.badgeRow}>
          <DoodleChip label={genderLabel(partner.gender)} tiny />
          <View style={styles.badge}>
            {partner.voiceMod ? (
              <MicOff color={colors.paper} size={14} />
            ) : (
              <Mic color={colors.paper} size={14} />
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
              style={[styles.gridCard, on ? styles.gridCardOn : null]}
              contentStyle={styles.gridInner}
            >
              <SpeedDateAvatar avatarId={p.avatarId} size={72} />
              <Text style={styles.gridNick} numberOfLines={1}>
                {p.nickname}
              </Text>
              <DoodleButton
                title={on ? "선택됨 ✓" : "선택"}
                onPress={() => onPick(p.profileId)}
                variant={on ? "primary" : "secondary"}
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
        <DoodleButton title="홈으로" onPress={() => router.replace("/home")} variant="primary" />
      </View>
    );
  }
  return (
    <View style={styles.roundWrap}>
      <Text style={styles.title}>{matches.length}명과 매칭됐어요!</Text>
      <Text style={styles.sub}>이제 1:1 채팅에서 실제 프로필로 대화를 이어가세요.</Text>
      {matches.map((m) => (
        <DoodleCard key={m.roomId} style={styles.matchCard} contentStyle={styles.matchInner}>
          <Text style={styles.nickname}>{m.nickname}</Text>
          <DoodleButton
            title="채팅 시작"
            variant="primary"
            onPress={() => router.replace({ pathname: "/(app)/chat/[roomId]", params: { roomId: m.roomId } })}
          />
        </DoodleCard>
      ))}
      <DoodleButton title="홈으로" onPress={() => router.replace("/home")} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  fullScreen: { flex: 1, backgroundColor: "#000" },
  stageFull: { flex: 1, backgroundColor: "#000" },
  avatarStage: { alignItems: "center", justifyContent: "center", backgroundColor: colors.ink },
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
    backgroundColor: "rgba(20,17,15,0.45)",
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  overlayMeta: { ...type.label, color: colors.paper },
  timerPill: {
    backgroundColor: colors.accent,
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
    backgroundColor: "rgba(20,17,15,0.45)",
  },
  overlayNick: { ...type.title, color: colors.paper },
  overlayBadgeText: { ...type.caption, color: colors.paper },
  overlayHint: { ...type.caption, color: colors.paper, textAlign: "center", opacity: 0.85 },
  selfView: {
    position: "absolute",
    right: 16,
    width: 104,
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 2,
    borderColor: colors.paper,
  },
  selfLabel: {
    position: "absolute",
    bottom: 4,
    left: 6,
    ...type.caption,
    color: colors.paper,
  },
  nickname: { ...type.title, color: colors.ink },
  badgeRow: { flexDirection: "row", gap: space.x2, flexWrap: "wrap", justifyContent: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4 },
  timer: { ...type.title, color: colors.accent },
  title: { ...type.title, color: colors.ink, textAlign: "center" },
  sub: { ...type.body, color: colors.grayDark, textAlign: "center" },
  msg: { ...type.heading, color: colors.ink, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.x3, justifyContent: "center" },
  gridCard: { width: 150 },
  gridCardOn: { borderColor: colors.accent },
  gridInner: { alignItems: "center", gap: space.x2, paddingVertical: space.x3 },
  gridNick: { ...type.label, color: colors.ink, maxWidth: 130 },
  matchCard: { width: "100%" },
  matchInner: { alignItems: "center", gap: space.x3, paddingVertical: space.x4 },
});
