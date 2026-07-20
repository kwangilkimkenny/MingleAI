import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Users } from "lucide-react-native";
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
import { colors, doodle, fonts } from "../../../src/lib/theme";

export default function PartyScreen() {
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

  // 2D room positions — ref-driven; a tick state re-renders only when something moved.
  const posRef = useRef<Record<string, { pos: Vec2; target: Vec2 }>>({});
  const rosterRef = useRef<string[]>([]);
  const lastSentRef = useRef<{ pos: Vec2 | null; at: number }>({ pos: null, at: 0 });
  const [, setFrame] = useState(0);
  const velRef = useRef<Vec2>({ x: 0, y: 0 });
  const facingRef = useRef<Record<string, 1 | -1>>({});

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
      if (moved) setFrame((f) => f + 1);
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
    socketRef.current?.startGame(partyId!);
  }
  function onVote(choice: GameChoice) {
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
            {party.name}
          </Text>
        </View>
        <View style={[styles.topBarActions, { marginTop: insets.top }]}>
          <Pressable
            style={styles.membersBtn}
            onPress={() => openMemberSheet(null)}
            accessibilityRole="button"
            accessibilityLabel="멤버 목록 보기"
            hitSlop={6}
          >
            <Users color={colors.ink} size={16} strokeWidth={2.2} />
          </Pressable>
          {amongEnded ? (
            <Pressable
              style={styles.lobbyBtn}
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
        {gameNotice ? (
          <View style={styles.noticeBanner} pointerEvents="none">
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
          />
        ) : (
          <PartyWorld characters={characters} showBalanceStation clock={clock} />
        )}

        <PartyChatOverlay
          messages={messages}
          myProfileId={myProfileId}
          socketDown={socketDown}
          senderName={senderName}
          onSend={onSendChat}
          hideFab={hideFab}
          fabStyle={{ bottom: undefined, top: 8, right: 12 + insets.right }}
        />

        {(!showAmong || among?.phase === "playing") && (
          <Joystick
            onVector={(v) => {
              const wasMoving = velRef.current.x !== 0 || velRef.current.y !== 0;
              velRef.current = v;
              if (wasMoving && v.x === 0 && v.y === 0) setFrame((f) => f + 1);
            }}
            style={[styles.joystick, { left: 16 + insets.left, bottom: 20 + insets.bottom }]}
          />
        )}

        {!showAmong && (
          <ActionPad
            main={lobbyMain}
            style={[styles.actionPad, { right: 16 + insets.right, bottom: 20 + insets.bottom }]}
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
        visible={balanceOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBalanceOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setBalanceOpen(false)}
            accessibilityLabel="밸런스 게임 닫기"
          />
          <View style={styles.balanceSheet}>
            <View style={styles.gameHeader}>
              <Text style={styles.gameTitle}>밸런스 게임</Text>
              <View style={styles.gameHeaderActions}>
                {game?.status === "active" ? (
                  <Pressable onPress={onEndGame} hitSlop={8}>
                    <Text style={styles.gameEnd}>게임 종료</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setBalanceOpen(false)} hitSlop={8}>
                  <Text style={styles.closeText}>닫기</Text>
                </Pressable>
              </View>
            </View>
            {!game ? (
              <Pressable style={styles.gameStartBtn} onPress={onStartGame}>
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
                    style={[styles.gameChoice, myVote === "a" && styles.gameChoiceMine]}
                    onPress={() => onVote("a")}
                  >
                    <Text
                      style={[styles.gameChoiceText, myVote === "a" && styles.gameChoiceTextMine]}
                    >
                      {game.question.a}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.gameChoice, myVote === "b" && styles.gameChoiceMine]}
                    onPress={() => onVote("b")}
                  >
                    <Text
                      style={[styles.gameChoiceText, myVote === "b" && styles.gameChoiceTextMine]}
                    >
                      {game.question.b}
                    </Text>
                  </Pressable>
                </View>
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
                <Pressable style={styles.gameStartBtn} onPress={onStartGame}>
                  <Text style={styles.gameStartText}>다시 하기</Text>
                </Pressable>
              </>
            )}
          </View>
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
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  lobbyBtn: {
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.ink,
  },
  lobbyBtnText: { color: colors.paper, fontSize: 12, fontWeight: "700" },

  modalRoot: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  balanceSheet: {
    backgroundColor: colors.paper,
    ...doodle.radius.card,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    width: "100%",
    maxWidth: 480,
    padding: 16,
    gap: 10,
  },
  gameHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gameHeaderActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  gameTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  gameEnd: { fontSize: 12, color: colors.grayMid, textDecorationLine: "underline" },
  closeText: { fontSize: 13, color: colors.grayMid, fontWeight: "600" },
  gameRound: { fontSize: 12, color: colors.grayDark },
  gameChoices: { flexDirection: "row", gap: 8 },
  gameChoice: {
    flex: 1,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  gameChoiceMine: { backgroundColor: colors.ink },
  gameChoiceText: { color: colors.ink, fontWeight: "700", fontSize: 13, textAlign: "center" },
  gameChoiceTextMine: { color: colors.paper },
  gameStartBtn: {
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  gameStartText: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  gameReveal: { fontSize: 12, color: colors.grayMid },
});
