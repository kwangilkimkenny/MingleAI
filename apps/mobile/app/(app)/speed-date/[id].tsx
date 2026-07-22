import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Mic, MicOff, Video, VideoOff, Heart } from "lucide-react-native";
import type { SpeedDateSnapshot, SpeedDateStage, PartnerView } from "@mingle/client-core";
import { DoodleButton, DoodleCard } from "../../../src/components/Doodle";
import { DoodleChip } from "../../../src/components/DoodleSvg";
import { BackButton } from "../../../src/components/BackButton";
import { SpeedDateAvatar } from "../../../src/components/speed-date/SpeedDateAvatar";
import { openSpeedDateSocket } from "../../../src/lib/speed-date-socket";
import { useSpeedDateMedia } from "../../../src/lib/speed-date-media";
import { useAuthStore } from "../../../src/lib/client";
import { hapticSelect } from "../../../src/lib/haptics";
import { colors, layout, space, type } from "../../../src/lib/theme";

const STAGE_LABEL: Record<SpeedDateStage, string> = {
  DISGUISED: "가면 라운드",
  VOICE: "목소리 공개",
  FACE: "얼굴 공개",
};
const STAGE_HINT: Record<SpeedDateStage, string> = {
  DISGUISED: "목소리는 변조되고 캐릭터 이미지만 보여요.",
  VOICE: "이제 진짜 목소리가 들려요. 얼굴은 아직 가림.",
  FACE: "카메라가 켜지고 얼굴이 공개돼요.",
};

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

  function toggleChoice(targetId: string) {
    if (!id) return;
    hapticSelect();
    socketRef.current?.choose(id, targetId, !chosen.has(targetId));
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

  return (
    <Screen insets={insets}>
      <ScrollView contentContainerStyle={styles.content}>
        {snapshot.phase === "preflight" ? (
          <Waiting title="곧 시작해요" sub="6명이 모두 준비되면 첫 대화가 열려요." seconds={remainSec} />
        ) : null}

        {snapshot.phase === "intermission" ? (
          <Waiting title="다음 상대와 연결 중…" sub="잠시만 기다려 주세요." seconds={remainSec} />
        ) : null}

        {snapshot.phase === "round" && snapshot.partner && snapshot.stage ? (
          <RoundView
            stage={snapshot.stage}
            partner={snapshot.partner}
            roundIndex={snapshot.roundIndex}
            roundCount={snapshot.roundCount}
            seconds={remainSec}
            chosen={chosen.has(snapshot.partner.profileId)}
            hasRemoteVideo={media.hasRemoteVideo}
            onToggle={() => snapshot.partner && toggleChoice(snapshot.partner.profileId)}
          />
        ) : null}

        {snapshot.phase === "decision" ? (
          <DecisionView
            partners={snapshot.metPartners}
            chosen={chosen}
            seconds={remainSec}
            onToggle={toggleChoice}
          />
        ) : null}

        {snapshot.phase === "ended" ? <ResultView result={snapshot.result} /> : null}
      </ScrollView>
    </Screen>
  );
}

function Screen({ insets, children }: { insets: ReturnType<typeof useSafeAreaInsets>; children: React.ReactNode }) {
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <BackButton />
        <Text style={styles.brand}>블라인드 데이트</Text>
        <View style={{ width: 40 }} />
      </View>
      {children}
    </View>
  );
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
  chosen,
  hasRemoteVideo,
  onToggle,
}: {
  stage: SpeedDateStage;
  partner: PartnerView;
  roundIndex: number;
  roundCount: number;
  seconds: number;
  chosen: boolean;
  hasRemoteVideo: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.roundWrap}>
      <View style={styles.stageRow}>
        <DoodleChip label={STAGE_LABEL[stage]} />
        <Text style={styles.roundMeta}>
          라운드 {roundIndex + 1}/{roundCount}
        </Text>
        <Text style={styles.timer}>{seconds}s</Text>
      </View>

      <DoodleCard style={styles.partnerCard} contentStyle={styles.partnerInner}>
        {hasRemoteVideo ? (
          <View style={styles.videoBox}>
            <Text style={styles.sub}>영상 연결됨</Text>
          </View>
        ) : (
          <SpeedDateAvatar avatarId={partner.avatarId} size={140} />
        )}
        <Text style={styles.nickname}>{partner.nickname}</Text>
        <View style={styles.badgeRow}>
          <DoodleChip label={genderLabel(partner.gender)} tiny />
          <View style={styles.badge}>
            {partner.voiceMod ? (
              <MicOff color={colors.grayDark} size={14} />
            ) : (
              <Mic color={colors.grayDark} size={14} />
            )}
            <Text style={styles.badgeText}>{partner.voiceMod ? "음성 변조" : "실제 목소리"}</Text>
          </View>
          <View style={styles.badge}>
            {partner.video ? (
              <Video color={colors.grayDark} size={14} />
            ) : (
              <VideoOff color={colors.grayDark} size={14} />
            )}
            <Text style={styles.badgeText}>{partner.video ? "얼굴 공개" : "얼굴 가림"}</Text>
          </View>
        </View>
        <Text style={styles.hint}>{STAGE_HINT[stage]}</Text>
      </DoodleCard>

      <DoodleButton
        title={chosen ? "다시 대화하고 싶어요 ✓" : "다시 대화하고 싶어요"}
        onPress={onToggle}
        variant={chosen ? "primary" : "secondary"}
        icon={(color, size) => <Heart color={color} size={size} strokeWidth={2} />}
      />
      <Text style={styles.privacy}>선택은 비공개예요. 서로 선택했을 때만 채팅이 열려요.</Text>
    </View>
  );
}

function DecisionView({
  partners,
  chosen,
  seconds,
  onToggle,
}: {
  partners: PartnerView[];
  chosen: Set<string>;
  seconds: number;
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.roundWrap}>
      <Text style={styles.title}>계속 대화하고 싶은 상대는?</Text>
      <Text style={styles.sub}>시간이 끝나면 지금 선택이 제출돼요. 선택은 비공개예요.</Text>
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
                onPress={() => onToggle(p.profileId)}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.x3, padding: space.x6 },
  roundWrap: { gap: space.x4, alignItems: "stretch" },
  stageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roundMeta: { ...type.label, color: colors.grayDark },
  timer: { ...type.title, color: colors.accent },
  partnerCard: { width: "100%" },
  partnerInner: { alignItems: "center", gap: space.x3, paddingVertical: space.x4 },
  videoBox: {
    width: 180,
    height: 180,
    borderRadius: 16,
    backgroundColor: colors.fillDeep,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.ink,
  },
  nickname: { ...type.title, color: colors.ink },
  badgeRow: { flexDirection: "row", gap: space.x2, flexWrap: "wrap", justifyContent: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4 },
  badgeText: { ...type.caption, color: colors.grayDark },
  hint: { ...type.caption, color: colors.grayDark, textAlign: "center" },
  privacy: { ...type.caption, color: colors.grayDark, textAlign: "center" },
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
