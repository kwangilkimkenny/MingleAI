import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Check, CircleHelp, ShieldCheck, Users } from "lucide-react-native";
import { DoodleButton } from "../../../src/components/Doodle";
import { DoodleChip } from "../../../src/components/DoodleSvg";
import { getMatchmakingStatus, sendProposal, ApiError } from "@mingle/client-core";
import type {
  PublicParty,
  PartyMessageView,
  PartySocketHandle,
  GameSnapshot,
  GameChoice,
} from "@mingle/client-core";
import { getPartyMessages } from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";
import { BackButton } from "../../../src/components/BackButton";
import { openPartySocket } from "../../../src/lib/party-socket";
import { resolveDisplayName } from "../../../src/lib/party-name";
import { PartyChatOverlay } from "../../../src/components/PartyChatOverlay";
import { MemberSheet } from "../../../src/components/MemberSheet";
import { PARTY_MAP, BALANCE_STATION_ID, type AmongSnapshot } from "@mingle/shared";
import {
  clampToRoom,
  spawnFor,
  stepToward,
  shouldEmit,
  moveWithCollision,
  worldDist,
  INTERACT_RANGE,
  type Vec2,
} from "../../../src/lib/party-space";
import { useLandscapeLock } from "../../../src/lib/use-landscape";
import { PartyWorld, type WorldCharacter } from "../../../src/components/party/PartyWorld";
import { Joystick } from "../../../src/components/party/Joystick";
import { ActionPad, type PadAction } from "../../../src/components/party/ActionPad";
import { AmongGame } from "../../../src/components/among/AmongGame";
import { colors, control, doodle, fonts, layout, space, type } from "../../../src/lib/theme";
import { secureStorage } from "../../../src/lib/secure-storage";
import { useReducedMotion } from "react-native-reanimated";
import { hapticImpact, hapticSelect } from "../../../src/lib/haptics";

// SecureStore native keys allow alphanumeric characters plus `.`, `-`, and `_`.
const PARTY_GUIDE_KEY = "mingle.party-guide-v1";
const WORLD_RENDER_INTERVAL_MS = 1000 / 30;

export default function PartyScreen() {
  const reducedMotion = useReducedMotion();
  useLandscapeLock();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const partyId = Array.isArray(id) ? id[0] : id;
  const myProfileId = useAuthStore((s) => s.profileId);
  const [party, setParty] = useState<PublicParty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposeErrors, setProposeErrors] = useState<Record<string, string>>({});
  const [proposeSent, setProposeSent] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const alive = useRef(true);

  const token = useAuthStore((s) => s.token);
  const [messages, setMessages] = useState<PartyMessageView[]>([]);
  const [presentCount, setPresentCount] = useState(0);
  const [socketDown, setSocketDown] = useState(false);
  const [gameNotice, setGameNotice] = useState<string | null>(null);
  const socketRef = useRef<PartySocketHandle | null>(null);

  const [game, setGame] = useState<GameSnapshot | null>(null);
  const [myVote, setMyVote] = useState<GameChoice | null>(null);
  const [among, setAmong] = useState<AmongSnapshot | null>(null);

  // Ended-result dismissal: once the player closes a session's result without hitting
  // 다시하기, we drop back to lobby mode for that sessionId specifically.
  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(null);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [memberSheetOpen, setMemberSheetOpen] = useState(false);
  const [memberSheetTarget, setMemberSheetTarget] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  // 2D room positions — ref-driven; a tick state re-renders only when something moved.
  const posRef = useRef<Record<string, { pos: Vec2; target: Vec2 }>>({});
  const rosterRef = useRef<string[]>([]);
  const lastSentRef = useRef<{ pos: Vec2 | null; at: number }>({ pos: null, at: 0 });
  const [, setFrame] = useState(0);
  const velRef = useRef<Vec2>({ x: 0, y: 0 });
  const facingRef = useRef<Record<string, 1 | -1>>({});

  useEffect(() => {
    let active = true;
    Promise.resolve(secureStorage.getItem(PARTY_GUIDE_KEY)).then((seen) => {
      if (active && seen !== "seen") setGuideOpen(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    alive.current = true;
    getMatchmakingStatus()
      .then((s) => {
        if (!alive.current) return;
        if (s.party && s.party.id === id) setParty(s.party);
        else setError("파티 정보를 찾을 수 없습니다.");
      })
      .catch((e) => {
        if (alive.current) setError(e instanceof ApiError ? e.message : "불러오기 실패");
      });
    return () => {
      alive.current = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !token || !party) return;
    let alive = true;
    getPartyMessages(id)
      .then((history) => alive && setMessages(history))
      .catch(() => alive && setSocketDown(true));
    const handle = openPartySocket(token, {
      onMessage: (m) =>
        alive && setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
      onPresence: (p) => {
        if (!alive) return;
        setPresentCount(p.members.length);
        rosterRef.current = p.members;
        for (const pid of p.members) {
          if (!posRef.current[pid]) {
            const spawn = spawnFor(pid);
            posRef.current[pid] = { pos: spawn, target: spawn };
          }
        }
        for (const pid of Object.keys(posRef.current)) {
          if (!p.members.includes(pid) && pid !== myProfileId) delete posRef.current[pid];
        }
        setFrame((f) => f + 1);
      },
      onMoved: (m) => {
        if (!alive) return;
        const entry = posRef.current[m.profileId];
        const target = clampToRoom({ x: m.x, y: m.y });
        if (entry) {
          entry.target = target;
        } else {
          // First signal from this peer — create at the reported spot and force a frame,
          // since an at-rest entry never marks the rAF loop as "moved".
          posRef.current[m.profileId] = { pos: target, target };
          setFrame((f) => f + 1);
        }
      },
      onGameState: (e) => {
        if (!alive) return;
        setGame((prev) =>
          e.snapshot ? e.snapshot : prev && prev.status === "ended" ? prev : null,
        );
        if (e.snapshot && e.snapshot.status === "active") {
          setMyVote((prev) =>
            e.snapshot!.votedProfileIds.includes(myProfileId ?? "") ? prev : null,
          );
        }
      },
      onAmongState: (e) => {
        if (!alive) return;
        if (e.partyId === id) setAmong(e.snapshot);
      },
      onError: (e) => {
        if (!alive) return;
        // party:error는 앱 레벨(게임/모더레이션) 에러 — 연결 상태 신호가 아니다.
        const msg =
          e && typeof e === "object" && "message" in e
            ? (e as { message?: unknown }).message
            : null;
        if (typeof msg !== "string") return;
        if (msg === "not-enough-players") setGameNotice("4명이 모여야 시작할 수 있어요");
        else if (msg === "AI 게임 준비 중이에요")
          setGameNotice("AI 게임 준비 중이에요 — 잠시 후 다시 시도해주세요");
        else if (msg === "invalid") setGameNotice("잘못된 요청이에요");
        else if (msg === "forbidden") setGameNotice("권한이 없어요");
        else setGameNotice(msg);
      },
      onReconnect: () => {
        if (!alive) return;
        setSocketDown(false);
        getPartyMessages(id)
          .then((h) => alive && setMessages(h))
          .catch(() => {});
      },
    });
    socketRef.current = handle;
    handle.joinParty(id);
    handle.syncGame(id);
    handle.syncAmong(id);
    if (myProfileId && !posRef.current[myProfileId]) {
      const spawn = spawnFor(myProfileId);
      posRef.current[myProfileId] = { pos: spawn, target: spawn };
    }
    return () => {
      alive = false;
      handle.leaveParty(id);
      handle.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token, party != null]);

  useEffect(() => {
    if (!gameNotice) return;
    const t = setTimeout(() => setGameNotice(null), 3000);
    return () => clearTimeout(t);
  }, [gameNotice]);

  // Animation loop: 내 캐릭터 = 조이스틱 속도 적분(충돌 포함), 피어 = target lerp.
  useEffect(() => {
    if (!id || !party) return;
    let raf = 0;
    let last = 0;
    let lastRenderedAt = 0;
    const loop = (now: number) => {
      const dt = last ? now - last : 16;
      last = now;
      let moved = false;
      for (const [pid, entry] of Object.entries(posRef.current)) {
        const next =
          pid === myProfileId
            ? moveWithCollision(entry.pos, velRef.current, dt)
            : stepToward(entry.pos, entry.target, dt);
        if (next.x !== entry.pos.x || next.y !== entry.pos.y) {
          if (next.x !== entry.pos.x) facingRef.current[pid] = next.x > entry.pos.x ? 1 : -1;
          entry.pos = next;
          moved = true;
          if (pid === myProfileId) {
            const sent = lastSentRef.current;
            if (shouldEmit(sent.pos, sent.at, next, now)) {
              socketRef.current?.move(id, next.x, next.y);
              lastSentRef.current = { pos: next, at: now };
            }
          }
        }
      }
      if (moved && now - lastRenderedAt >= WORLD_RENDER_INTERVAL_MS) {
        lastRenderedAt = now;
        setFrame((f) => f + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id, party != null, myProfileId]);

  // among:state phase != "ended" (or unread state and phase != ended) → the game world
  // owns the screen. Ended sessions stay on AmongGame's ResultScreen until the player
  // explicitly dismisses back to the lobby (or hits 다시하기, which starts a new session).
  const showAmong =
    among !== null && !(among.phase === "ended" && dismissedSessionId === among.sessionId);
  const amongEnded = showAmong && among !== null && among.phase === "ended";
  // 리빌 중 겹침은 리빌 카드가 zIndex 100 전체 오버레이라 FAB 가림 허용 — meeting/voting은 채팅 개방.
  const hideFab = showAmong && among?.phase === "ended";

  // Backend enforces one active session per party at a time — never let a stale
  // balance-game/member sheet overlay linger once Among Us takes the screen.
  useEffect(() => {
    if (showAmong) {
      setBalanceOpen(false);
      setMemberSheetOpen(false);
    }
  }, [showAmong]);

  // 게임 종료/세션 소멸 시 프레즌스에 없는 캐릭터(AI 페르소나) 정리 — 로비 잔상 방지.
  // AI 임포스터는 among 세션 동안만 posRef에 존재하는데(party:presence는 사람만 담는다),
  // 세션이 ended로 전환되거나 소멸(null)되면 로비 렌더러(PartyWorld)로 돌아가면서
  // 그 캐릭터가 화면에 그대로 남아 걸어다니는 것처럼 보이는 버그를 막는다.
  useEffect(() => {
    if (among === null || among.phase === "ended") {
      let removed = false;
      for (const pid of Object.keys(posRef.current)) {
        if (pid !== myProfileId && !rosterRef.current.includes(pid)) {
          delete posRef.current[pid];
          removed = true;
        }
      }
      if (removed) setFrame((f) => f + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [among === null, among?.phase, among?.sessionId, myProfileId]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <DoodleButton title="홈으로" onPress={() => router.replace("/home")} />
      </View>
    );
  }
  if (!party) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  async function onPropose(toProfileId: string) {
    if (!partyId) return;
    try {
      await sendProposal(partyId, toProfileId);
      setProposeSent((prev) => ({ ...prev, [toProfileId]: true }));
      setProposeErrors((prev) => ({ ...prev, [toProfileId]: "" }));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "프로포즈 실패";
      setProposeErrors((prev) => ({ ...prev, [toProfileId]: msg }));
    }
  }

  function onSendChat(content: string) {
    if (!content || !partyId) return;
    socketRef.current?.sendChat(partyId, content);
  }

  function onStartGame() {
    hapticImpact();
    socketRef.current?.startGame(partyId!);
  }
  function onVote(choice: GameChoice) {
    hapticSelect();
    setMyVote(choice);
    socketRef.current?.voteGame(partyId!, choice);
  }
  function onEndGame() {
    socketRef.current?.endGame(partyId!);
  }

  function openMemberSheet(profileId: string | null) {
    setMemberSheetTarget(profileId);
    setMemberSheetOpen(true);
  }

  function dismissGuide() {
    setGuideOpen(false);
    void secureStorage.setItem(PARTY_GUIDE_KEY, "seen");
  }

  const clock = Date.now();
  const characters: WorldCharacter[] = Object.entries(posRef.current).map(([pid, entry]) => {
    const mine = pid === myProfileId;
    const walking = mine
      ? velRef.current.x !== 0 || velRef.current.y !== 0
      : worldDist(entry.pos, entry.target) > 0.002;
    return {
      profileId: pid,
      name: resolveDisplayName(pid, party.participants, among?.players, myProfileId),
      pos: entry.pos,
      mine,
      walking,
      facing: facingRef.current[pid] ?? 1,
    };
  });

  const positions: Record<string, Vec2> = {};
  for (const [pid, entry] of Object.entries(posRef.current)) {
    positions[pid] = entry.pos;
  }

  const myPos = myProfileId ? (posRef.current[myProfileId]?.pos ?? null) : null;
  const balanceAnchor = PARTY_MAP.stations.find((s) => s.id === BALANCE_STATION_ID)!;
  const nearBalance = myPos !== null && worldDist(myPos, balanceAnchor) <= INTERACT_RANGE;
  let nearPeer: WorldCharacter | null = null;
  if (myPos) {
    let bd = Infinity;
    for (const c of characters) {
      if (c.mine || hidden[c.profileId]) continue;
      const d = worldDist(myPos, c.pos);
      if (d <= INTERACT_RANGE && d < bd) {
        nearPeer = c;
        bd = d;
      }
    }
  }
  const lobbyMain: PadAction = nearBalance
    ? {
        key: "balance",
        // 76px 원형 버튼에 5자 이상은 잘림("밸런스 ...") — 4자 이내 유지
        label: game?.status === "active" ? "게임 참여" : "밸런스",
        onPress: () => setBalanceOpen(true),
      }
    : nearPeer
      ? { key: "profile", label: "프로필", onPress: () => openMemberSheet(nearPeer!.profileId) }
      : { key: "idle", label: "사용", onPress: () => {}, disabled: true };

  const objective = nearBalance
    ? {
        title: "밸런스 게임을 열어보세요",
        detail: "오른쪽 아래 ‘밸런스’ 버튼을 누르면 모두가 답할 질문을 시작할 수 있어요.",
      }
    : nearPeer
      ? {
          title: `${nearPeer.name}님과 가까워졌어요`,
          detail: "오른쪽 아래 ‘프로필’을 눌러 소개를 보고, 충분히 알아본 뒤 프로포즈하세요.",
        }
      : {
          title: "먼저 월드를 둘러보세요",
          detail: "왼쪽 조이스틱으로 이동해 멤버나 밸런스 게임 스테이션에 가까이 가보세요.",
        };

  const amongHandlers = {
    start: () => socketRef.current?.startAmong(partyId!),
    doTask: (taskId: string, x: number, y: number) =>
      socketRef.current?.doAmongTask(partyId!, taskId, x, y),
    kill: (t: string, x: number, y: number) => socketRef.current?.killAmong(partyId!, t, x, y),
    report: (b: string) => socketRef.current?.reportAmong(partyId!, b),
    emergency: () => socketRef.current?.emergencyAmong(partyId!),
    vote: (t: string) => socketRef.current?.voteAmong(partyId!, t),
    restart: () => socketRef.current?.startAmong(partyId!),
  };

  const visibleParticipants = party.participants.filter((p) => !hidden[p.profileId]);

  function senderName(profileId: string) {
    return resolveDisplayName(profileId, party?.participants ?? [], among?.players, myProfileId);
  }

  return (
    <View style={styles.screen}>
      <View
        style={[styles.topBar, { paddingLeft: 4 + insets.left, paddingRight: 4 + insets.right }]}
      >
        <BackButton label="나가기" onPress={() => router.replace("/home")} />
        <View style={[styles.topBarInfo, { marginTop: insets.top }]}>
          <Text style={styles.partyName} numberOfLines={1}>
            오늘의 게임 파티
          </Text>
        </View>
        <View style={[styles.topBarActions, { marginTop: insets.top }]}>
          <Pressable
            style={({ pressed }) => [styles.membersBtn, pressed && styles.buttonPressed]}
            onPress={() => setGuideOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="게임 이용 방법"
          >
            <CircleHelp color={colors.ink} size={19} strokeWidth={2.2} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.membersBtn, pressed && styles.buttonPressed]}
            onPress={() => openMemberSheet(null)}
            accessibilityRole="button"
            accessibilityLabel="멤버 목록과 안전 메뉴 보기"
          >
            <Users color={colors.ink} size={19} strokeWidth={2.2} />
          </Pressable>
          {amongEnded ? (
            <Pressable
              style={({ pressed }) => [styles.lobbyBtn, pressed && styles.buttonPressed]}
              onPress={() => setDismissedSessionId(among!.sessionId)}
              accessibilityRole="button"
              accessibilityLabel="로비로 돌아가기"
            >
              <Text style={styles.lobbyBtnText}>로비로</Text>
            </Pressable>
          ) : null}
          <DoodleChip label={`${presentCount}명`} tiny />
        </View>
      </View>

      <View style={styles.world}>
        {!showAmong ? (
          <View
            style={[styles.objectiveHud, { left: layout.hudEdge + insets.left, pointerEvents: "none" }]}
            accessible
            accessibilityLabel={`지금 할 일. ${objective.title}. ${objective.detail}`}
          >
            <View style={styles.objectiveLabelRow}>
              <Text style={styles.objectiveEyebrow}>지금 할 일</Text>
              <View style={styles.safeStatus}>
                <ShieldCheck size={12} color={colors.success} strokeWidth={2.5} />
                <Text style={styles.safeStatusText}>신고·차단 가능</Text>
              </View>
            </View>
            <Text style={styles.objectiveTitle} numberOfLines={2}>
              {objective.title}
            </Text>
            <Text style={styles.objectiveDetail} numberOfLines={3}>
              {objective.detail}
            </Text>
          </View>
        ) : null}
        {gameNotice ? (
          <View style={[styles.noticeBanner, { pointerEvents: "none" }]}>
            <Text style={styles.noticeText}>{gameNotice}</Text>
          </View>
        ) : null}

        {showAmong && among ? (
          <AmongGame
            among={among}
            myProfileId={myProfileId ?? ""}
            partyId={partyId!}
            positions={positions}
            characters={characters}
            clock={clock}
            handlers={amongHandlers}
            balanceReveals={game?.reveals ?? []}
            onReturnToLobby={() => setDismissedSessionId(among.sessionId)}
          />
        ) : (
          <PartyWorld
            characters={characters}
            showBalanceStation
            safeInsets={insets}
            clock={clock}
          />
        )}

        <PartyChatOverlay
          messages={messages}
          myProfileId={myProfileId}
          socketDown={socketDown}
          senderName={senderName}
          onSend={onSendChat}
          hideFab={hideFab}
          fabStyle={{ bottom: undefined, top: layout.hudGap, right: layout.hudEdge + insets.right }}
        />

        {(!showAmong || among?.phase === "playing") && (
          <Joystick
            onVector={(v) => {
              const wasMoving = velRef.current.x !== 0 || velRef.current.y !== 0;
              velRef.current = v;
              if (wasMoving && v.x === 0 && v.y === 0) setFrame((f) => f + 1);
            }}
            style={[
              styles.joystick,
              { left: layout.hudEdge + insets.left, bottom: layout.hudBottom + insets.bottom },
            ]}
          />
        )}

        {!showAmong && (
          <ActionPad
            main={lobbyMain}
            style={[
              styles.actionPad,
              { right: layout.hudEdge + insets.right, bottom: layout.hudBottom + insets.bottom },
            ]}
          />
        )}
      </View>

      <MemberSheet
        visible={memberSheetOpen}
        members={visibleParticipants}
        initialProfileId={memberSheetTarget}
        myProfileId={myProfileId}
        partyId={partyId ?? ""}
        proposeSent={proposeSent}
        proposeErrors={proposeErrors}
        onPropose={onPropose}
        onBlocked={(pid) => setHidden((prev) => ({ ...prev, [pid]: true }))}
        onClose={() => setMemberSheetOpen(false)}
      />

      <Modal
        visible={guideOpen}
        transparent
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={dismissGuide}
      >
        <View style={styles.modalRoot} accessibilityViewIsModal>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissGuide}
            accessibilityRole="button"
            accessibilityLabel="게임 안내 닫기"
          />
          <View style={styles.guideCard}>
            <ScrollView
              style={styles.guideScroll}
              contentContainerStyle={styles.guideScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.guideEyebrow}>GAME GUIDE</Text>
              <Text style={styles.guideTitle}>게임은 대화를 시작하는 방법이에요</Text>
              <Text style={styles.guideLead}>
                점수를 겨루기보다 움직이고, 답하고, 이야기하며 서로의 분위기를 알아보세요.
              </Text>
              <View style={styles.guideSteps}>
                <View style={styles.guideStep}>
                  <Text style={styles.guideNumber}>1</Text>
                  <View style={styles.guideStepText}>
                    <Text style={styles.guideStepTitle}>이동</Text>
                    <Text style={styles.guideStepBody}>왼쪽 조이스틱으로 멤버나 게임 장소에 다가가요.</Text>
                  </View>
                </View>
                <View style={styles.guideStep}>
                  <Text style={styles.guideNumber}>2</Text>
                  <View style={styles.guideStepText}>
                    <Text style={styles.guideStepTitle}>상호작용</Text>
                    <Text style={styles.guideStepBody}>오른쪽 버튼은 가까운 대상에 맞춰 ‘프로필’ 또는 ‘밸런스’로 바뀌어요.</Text>
                  </View>
                </View>
                <View style={styles.guideStep}>
                  <Text style={styles.guideNumber}>3</Text>
                  <View style={styles.guideStepText}>
                    <Text style={styles.guideStepTitle}>대화와 안전</Text>
                    <Text style={styles.guideStepBody}>우상단 채팅과 멤버 메뉴에서 대화하거나 신고·차단할 수 있어요.</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
            <View style={styles.guideAction}>
              <DoodleButton title="둘러보기 시작" onPress={dismissGuide} variant="primary" />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={balanceOpen}
        transparent
        animationType={reducedMotion ? "none" : "slide"}
        onRequestClose={() => setBalanceOpen(false)}
      >
        <View style={styles.modalRoot} accessibilityViewIsModal>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setBalanceOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="밸런스 게임 닫기"
          />
          <ScrollView
            style={styles.balanceSheet}
            contentContainerStyle={styles.balanceSheetContent}
            showsVerticalScrollIndicator
          >
            <View style={styles.gameHeader}>
              <Text style={styles.gameTitle}>밸런스 게임</Text>
              <View style={styles.gameHeaderActions}>
                {game?.status === "active" ? (
                  <Pressable
                    onPress={onEndGame}
                    style={({ pressed }) => [styles.gameHeaderButton, pressed && styles.buttonPressed]}
                    accessibilityRole="button"
                    accessibilityLabel="밸런스 게임 종료"
                  >
                    <Text style={styles.gameEnd}>게임 종료</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setBalanceOpen(false)}
                  style={({ pressed }) => [styles.gameHeaderButton, pressed && styles.buttonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="밸런스 게임 닫기"
                >
                  <Text style={styles.closeText}>닫기</Text>
                </Pressable>
              </View>
            </View>
            {!game ? (
              <Pressable
                style={({ pressed }) => [styles.gameStartBtn, pressed && styles.buttonPressed]}
                onPress={onStartGame}
                accessibilityRole="button"
              >
                <Text style={styles.gameStartText}>밸런스 게임 시작</Text>
              </Pressable>
            ) : game.status === "active" && game.question ? (
              <>
                <Text style={styles.gameRound}>
                  {game.round + 1}/{game.totalRounds} 라운드 · {game.votedProfileIds.length}명 투표
                  완료
                </Text>
                <View style={styles.gameChoices}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.gameChoice,
                      myVote === "a" && styles.gameChoiceMine,
                      myVote !== null && myVote !== "a" && styles.gameChoiceNotMine,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => onVote("a")}
                    disabled={myVote !== null}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: myVote === "a", disabled: myVote !== null }}
                    accessibilityLabel={game.question.a}
                  >
                    {myVote === "a" ? <Check size={18} color={colors.onAccent} strokeWidth={3} /> : null}
                    <Text
                      style={[styles.gameChoiceText, myVote === "a" && styles.gameChoiceTextMine]}
                    >
                      {game.question.a}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.gameChoice,
                      myVote === "b" && styles.gameChoiceMine,
                      myVote !== null && myVote !== "b" && styles.gameChoiceNotMine,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => onVote("b")}
                    disabled={myVote !== null}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: myVote === "b", disabled: myVote !== null }}
                    accessibilityLabel={game.question.b}
                  >
                    {myVote === "b" ? <Check size={18} color={colors.onAccent} strokeWidth={3} /> : null}
                    <Text
                      style={[styles.gameChoiceText, myVote === "b" && styles.gameChoiceTextMine]}
                    >
                      {game.question.b}
                    </Text>
                  </Pressable>
                </View>
                <Text accessibilityLiveRegion="polite" style={styles.answerStatus}>
                  {myVote ? "답을 보냈어요. 다른 멤버를 기다리는 중이에요." : "둘 중 내 취향에 가까운 답을 하나 선택하세요."}
                </Text>
                {game.reveals.length > 0 ? (
                  <Text style={styles.gameReveal}>
                    지난 라운드: {game.reveals.at(-1)!.question.a}{" "}
                    {game.reveals.at(-1)!.aVoters.length}표 vs {game.reveals.at(-1)!.question.b}{" "}
                    {game.reveals.at(-1)!.bVoters.length}표
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.gameRound}>게임 결과</Text>
                {game.reveals.map((r) => (
                  <Text key={r.round} style={styles.gameReveal}>
                    {r.question.a} {r.aVoters.length}표 vs {r.question.b} {r.bVoters.length}표
                  </Text>
                ))}
                <Pressable
                  style={({ pressed }) => [styles.gameStartBtn, pressed && styles.buttonPressed]}
                  onPress={onStartGame}
                  accessibilityRole="button"
                >
                  <Text style={styles.gameStartText}>다시 하기</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 24 },
  error: { color: colors.ink, textAlign: "center" },

  screen: { flex: 1, backgroundColor: colors.paper },
  world: { flex: 1, position: "relative" },

  joystick: { position: "absolute", zIndex: 20 },
  actionPad: { position: "absolute", zIndex: 20 },

  noticeBanner: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    zIndex: 30,
    maxWidth: "80%",
    backgroundColor: colors.ink,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  noticeText: { color: colors.paper, fontSize: 13, fontWeight: "700", textAlign: "center" },

  objectiveHud: {
    position: "absolute",
    top: 8,
    zIndex: 18,
    width: "42%",
    maxWidth: 360,
    minWidth: 250,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingHorizontal: space.x3,
    paddingVertical: space.x2,
    gap: space.x1,
  },
  objectiveLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  objectiveEyebrow: { ...type.caption, color: colors.accentDeep, fontFamily: fonts.bodySemibold },
  safeStatus: { flexDirection: "row", alignItems: "center", gap: 3 },
  safeStatusText: { ...type.caption, color: colors.grayDark, fontFamily: fonts.bodySemibold },
  objectiveTitle: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23, color: colors.ink },
  objectiveDetail: { ...type.caption, color: colors.grayDark },

  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingBottom: 8,
  },
  topBarInfo: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 0,
  },
  partyName: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingRight: 12,
  },
  membersBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  buttonPressed: { transform: [{ translateY: 2 }, { scale: 0.985 }], opacity: 0.9 },
  lobbyBtn: {
    minHeight: control.minTouch,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: space.x2,
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  lobbyBtnText: { ...type.label, color: colors.paper },

  modalRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: space.x5,
    backgroundColor: "rgba(23,21,15,0.64)",
  },
  guideCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "92%",
    backgroundColor: colors.paper,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    ...doodle.radius.card,
    padding: 20,
    gap: 10,
  },
  guideScroll: { flexShrink: 1, minHeight: 0 },
  guideScrollContent: { gap: 10, paddingBottom: 4 },
  guideAction: { flexShrink: 0 },
  guideEyebrow: { ...type.caption, color: colors.accentDeep, fontFamily: fonts.bodySemibold },
  guideTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, color: colors.ink },
  guideLead: { ...type.body, color: colors.grayDark },
  guideSteps: { gap: 10, marginVertical: 4 },
  guideStep: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  guideNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: "hidden",
    backgroundColor: colors.ink,
    color: colors.paper,
    textAlign: "center",
    lineHeight: 26,
    fontWeight: "800",
  },
  guideStepText: { flex: 1 },
  guideStepTitle: { ...type.label, color: colors.ink },
  guideStepBody: { ...type.caption, color: colors.grayDark, marginTop: 1 },
  balanceSheet: {
    backgroundColor: colors.paper,
    ...doodle.radius.card,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    width: "100%",
    maxWidth: 480,
    maxHeight: "92%",
  },
  balanceSheetContent: {
    padding: 16,
    gap: 10,
  },
  gameHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gameHeaderActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  gameHeaderButton: { minWidth: control.minTouch, minHeight: control.minTouch, alignItems: "center", justifyContent: "center" },
  gameTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  gameEnd: { ...type.caption, color: colors.danger, textDecorationLine: "underline" },
  closeText: { ...type.label, color: colors.ink },
  gameRound: { ...type.caption, color: colors.grayDark },
  gameChoices: { flexDirection: "row", gap: 8 },
  gameChoice: {
    flex: 1,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 8,
    minHeight: 64,
    paddingVertical: space.x3,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  gameChoiceMine: { backgroundColor: colors.accent },
  gameChoiceNotMine: { backgroundColor: colors.fillDeep, borderColor: colors.grayLight },
  gameChoiceText: { ...type.label, color: colors.ink, textAlign: "center" },
  gameChoiceTextMine: { color: colors.paper },
  answerStatus: { ...type.caption, color: colors.grayDark, textAlign: "center" },
  gameStartBtn: {
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 8,
    minHeight: control.buttonHeight,
    paddingVertical: space.x2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  gameStartText: { ...type.label, color: colors.onAccent },
  gameReveal: { ...type.caption, color: colors.grayDark },
});
