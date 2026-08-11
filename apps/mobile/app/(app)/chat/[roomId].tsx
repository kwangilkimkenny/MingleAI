import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  FlatList,
  Image,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  getRoomMessages,
  sendMessage,
  markRoomRead,
  getMatches,
  ApiError,
  type DirectMessage,
  type MatchSummary,
  type MessengerSocketHandle,
  suggestReplies,
} from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";
import { openMessengerSocket } from "../../../src/lib/messenger-socket";
import { mergeNewest, newestFirst } from "../../../src/lib/chat-order";
import { pickAndUploadPhoto } from "../../../src/lib/photo";
import { PeerModerationMenu } from "../../../src/components/PeerModerationMenu";
import { AppScreen } from "../../../src/components/AppScreen";
import { colors, control, dark, doodle, space, type } from "../../../src/lib/theme";
import { InlineNotice, StateView } from "../../../src/components/Foundation";
import { CalendarDays, ImagePlus, Send, Sparkles, X } from "lucide-react-native";

/** 블라인드 데이트 매치 직후의 첫 메시지 후보 — 방금 대화한 사이라는 맥락에 맞춘 오프너. */
const OPENERS = [
  "아까 대화 즐거웠어요. 이어서 얘기해요!",
  "목소리가 기억에 남아요. 다시 만나서 반가워요.",
  "우리 아까 하던 얘기 마저 해요!",
  "서로 골랐네요! 신기하고 반가워요.",
  "얼굴 보고 나니 더 반갑네요. 잘 부탁해요!",
  "아까 못 물어본 게 하나 있어요!",
];

function pickOpeners(n: number): string[] {
  const pool = [...OPENERS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export default function ChatRoom() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const myProfileId = useAuthStore((s) => s.profileId);
  const token = useAuthStore((s) => s.token);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  // 매치 직후 콜드오픈 마찰 제거 — 추천 첫 메시지 3개(탭하면 입력창에 채워짐).
  const [openers] = useState(() => pickOpeners(3));
  const [peerTyping, setPeerTyping] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // 다음 멘트 추천 — 서버가 LLM으로 만든다. 탭하면 입력창에 채우고, 보내기는 사용자가 한다.
  const [tips, setTips] = useState<string[] | null>(null);
  const [tipsBusy, setTipsBusy] = useState(false);
  // 사진 첨부 — 업로드해서 URL을 받은 뒤 메시지로 보낸다(캡션 없이 사진만도 가능).
  const [attaching, setAttaching] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const alive = useRef(true);
  const socketRef = useRef<MessengerSocketHandle | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isTypingRef = useRef(false);

  // Load initial history + peer info
  useEffect(() => {
    if (!roomId) return;
    alive.current = true;
    setLoadError(null);

    Promise.all([getRoomMessages(roomId), getMatches()])
      .then(([msgs, rooms]) => {
        if (!alive.current) return;
        setMessages(newestFirst(msgs));
        setMatch(rooms.find((r) => r.roomId === roomId) ?? null);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive.current) return;
        setLoadError(e instanceof ApiError ? e.message : "대화를 불러오지 못했어요.");
        setLoading(false);
      });

    return () => {
      alive.current = false;
    };
  }, [roomId]);

  // Socket: connect + join on mount, disconnect on unmount
  useEffect(() => {
    if (!roomId || !token) return;

    const handle = openMessengerSocket(token, {
      onMessage: (e) => {
        if (!alive.current || e.roomId !== roomId) return;
        // dedup: sender already optimistically prepended the message in onSend
        setMessages((prev) =>
          prev.some((m) => m.id === e.message.id) ? prev : [e.message, ...prev],
        );
        markRoomRead(roomId).catch(() => {});
      },
      onReconnect: () => {
        // Refetch history to fill any gap that occurred during the disconnect.
        if (!alive.current) return;
        getRoomMessages(roomId)
          .then((fresh) => {
            if (!alive.current) return;
            setMessages((prev) => mergeNewest(prev, fresh));
          })
          .catch(() => {});
      },
      onRead: (e) => {
        if (!alive.current || e.roomId !== roomId) return;
        // mark my sent messages ≤ lastReadAt as read
        setMessages((prev) =>
          prev.map((m) =>
            m.senderProfileId === myProfileId && m.createdAt <= e.lastReadAt
              ? { ...m, readAt: e.lastReadAt }
              : m,
          ),
        );
      },
      onTyping: (e) => {
        if (!alive.current || e.roomId !== roomId) return;
        if (e.profileId === myProfileId) return;
        setPeerTyping(e.isTyping);
      },
    });

    handle.joinRoom(roomId);
    socketRef.current = handle;

    return () => {
      clearTimeout(typingTimerRef.current);
      handle.leaveRoom(roomId);
      handle.disconnect();
      socketRef.current = null;
    };
  }, [roomId, token, myProfileId]);

  // Mark read on focus
  useFocusEffect(
    useCallback(() => {
      if (!roomId) return;
      markRoomRead(roomId).catch(() => {});
    }, [roomId]),
  );

  function stopTyping() {
    clearTimeout(typingTimerRef.current);
    if (isTypingRef.current && socketRef.current && roomId) {
      isTypingRef.current = false;
      socketRef.current.setTyping(roomId, false);
    }
  }

  function onChangeText(val: string) {
    setText(val);
    if (!roomId || !socketRef.current) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current.setTyping(roomId, true);
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, 3000);
  }

  async function onSuggest() {
    if (tipsBusy || !roomId) return;
    if (tips) {
      setTips(null);
      return;
    }
    setTipsBusy(true);
    setSendError(null);
    try {
      const res = await suggestReplies(roomId);
      if (alive.current) setTips(res.suggestions);
    } catch {
      if (alive.current) setSendError("추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (alive.current) setTipsBusy(false);
    }
  }

  /** 사진 고르기 → 업로드 → 그대로 전송(카카오톡처럼 캡션 없이 바로 간다). */
  async function onAttachPhoto() {
    if (attaching || sending || !roomId) return;
    setAttaching(true);
    setSendError(null);
    try {
      const picked = await pickAndUploadPhoto({ square: false });
      if (picked.status === "cancelled") return;
      if (picked.status === "denied") {
        setSendError("사진 접근을 허용해야 첨부할 수 있어요.");
        return;
      }
      if (picked.status === "error") {
        setSendError(picked.message);
        return;
      }
      await deliver("", picked.url);
    } finally {
      if (alive.current) setAttaching(false);
    }
  }

  /** 텍스트/이미지 공통 전송 경로 — 낙관적 추가와 중복 방어를 한곳에 둔다. */
  async function deliver(content: string, imageUrl?: string) {
    if (!roomId) return;
    try {
      const msg = await sendMessage(roomId, content, imageUrl);
      if (alive.current)
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]));
      return msg;
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : "메시지를 보내지 못했어요. 다시 시도해 주세요.");
      return null;
    }
  }

  async function onSend() {
    const content = text.trim();
    if (!content || !roomId || sending) return;
    setSending(true);
    setSendError(null);
    stopTyping();
    try {
      const msg = await deliver(content);
      // dedup은 deliver가 처리한다(소켓 에코가 REST 응답보다 먼저 올 수 있다).
      if (msg) setText("");
    } finally {
      setSending(false);
    }
  }

  function formatTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  }

  if (loading) {
    return (
      <AppScreen tone="dark" body="plain">
        <StateView title="대화를 불러오고 있어요" loading dark />
      </AppScreen>
    );
  }
  if (loadError) {
    return (
      <AppScreen tone="dark" body="plain" header={{ back: true, title: "채팅" }}>
        <StateView
          title="대화를 열지 못했어요"
          body={loadError}
          actionLabel="채팅 목록으로"
          onAction={() => router.replace("/chats")}
          dark
        />
      </AppScreen>
    );
  }

  const headerAction =
    match != null ? (
      <View style={styles.headerActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="만남 계획"
          onPress={() =>
            // new route — Expo Router typegen updates on next `expo start`
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.push({
              pathname: "/(app)/date-plan/[matchId]" as any,
              params: { matchId: match.matchId },
            })
          }
          style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}
        >
          <CalendarDays color={dark.text} size={22} strokeWidth={1.75} />
        </Pressable>
        <PeerModerationMenu
          dark
          peer={{ profileId: match.peer.profileId, name: match.peer.name }}
          onBlocked={() => router.replace("/chats")}
        />
      </View>
    ) : undefined;

  const composeBar = (
    <View style={styles.compose}>
      {sendError ? (
        <InlineNotice tone="error" dark>
          {sendError}
        </InlineNotice>
      ) : null}
      {tips ? (
        <View style={styles.tips}>
          <View style={styles.tipsHead}>
            <Text style={styles.tipsTitle}>이렇게 이어볼까요?</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="추천 닫기" hitSlop={8} onPress={() => setTips(null)}>
              <X color={dark.textMuted} size={16} strokeWidth={2} />
            </Pressable>
          </View>
          {tips.map((tip) => (
            <Pressable
              key={tip}
              accessibilityRole="button"
              accessibilityLabel={`추천 문장 사용: ${tip}`}
              onPress={() => {
                setText(tip);
                setTips(null);
              }}
              style={({ pressed }) => [styles.tipChip, pressed && styles.pressed]}
            >
              <Text style={styles.tipText}>{tip}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.composeRow}>
        <Pressable
          style={({ pressed }) => [styles.suggestBtn, pressed && styles.pressed]}
          onPress={onAttachPhoto}
          disabled={attaching || sending}
          accessibilityRole="button"
          accessibilityLabel="사진 첨부"
          accessibilityState={{ busy: attaching }}
        >
          {attaching ? (
            <ActivityIndicator size="small" color={dark.textMuted} />
          ) : (
            <ImagePlus color={dark.textMuted} size={20} strokeWidth={1.75} />
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.suggestBtn, pressed && styles.pressed]}
          onPress={onSuggest}
          disabled={tipsBusy}
          accessibilityRole="button"
          accessibilityLabel={tips ? "추천 닫기" : "다음 멘트 추천받기"}
          accessibilityState={{ busy: tipsBusy, expanded: !!tips }}
        >
          {tipsBusy ? (
            <ActivityIndicator size="small" color={dark.textMuted} />
          ) : (
            <Sparkles color={tips ? dark.accent : dark.textMuted} size={20} strokeWidth={1.75} />
          )}
        </Pressable>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onChangeText}
          placeholder="메시지를 입력하세요"
          placeholderTextColor={dark.textMuted}
          multiline
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={onSend}
          accessibilityLabel="메시지 입력"
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            (!text.trim() || sending) && styles.sendBtnDisabled,
            pressed && styles.pressed,
          ]}
          onPress={onSend}
          disabled={!text.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel={sending ? "메시지 전송 중" : "메시지 전송"}
          accessibilityState={{ disabled: !text.trim() || sending, busy: sending }}
        >
          <Send color={!text.trim() || sending ? dark.textMuted : dark.onPill} size={20} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <AppScreen
        tone="dark"
        header={{ back: true, title: match?.peer.name ?? "채팅", action: headerAction }}
        body="plain"
        footer={composeBar}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>첫 인사를 건네보세요</Text>
            <Text style={styles.emptyBody}>방금 나눈 대화를 이어가도 좋아요.</Text>
            <View style={styles.openerCol}>
              {openers.map((o) => (
                <Pressable
                  key={o}
                  accessibilityRole="button"
                  accessibilityLabel={`추천 첫 메시지: ${o}`}
                  onPress={() => onChangeText(o)}
                  style={({ pressed }) => [styles.openerChip, pressed && styles.pressed]}
                >
                  <Text style={styles.openerText}>{o}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            style={styles.flex}
            inverted
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messages}
            ListHeaderComponent={
              peerTyping ? (
                <View style={[styles.row, styles.rowPeer]}>
                  <View style={[styles.bubble, styles.bubblePeer]}>
                    <Text style={styles.bubbleText}>···</Text>
                  </View>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const isMe = item.senderProfileId === myProfileId;
              const body = item.imageUrl ? "사진" : item.content;
              const meta = `${formatTime(item.createdAt)}${isMe && item.readAt ? " · 읽음" : ""}`;
              return (
                <View
                  style={[styles.row, isMe ? styles.rowMe : styles.rowPeer]}
                  accessibilityLabel={`${isMe ? "내 메시지" : `${match?.peer.name ?? "상대"}의 메시지`}, ${body}, ${meta}`}
                >
                  {/* 사진은 말풍선 없이 이미지만 — 배경을 씌우면 사진이 액자에 갇힌 것처럼 보인다. */}
                  {item.imageUrl ? (
                    <ChatPhoto uri={item.imageUrl} onPress={() => setViewerUrl(item.imageUrl ?? null)} />
                  ) : null}

                  {item.content ? (
                    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubblePeer]}>
                      <Text style={styles.bubbleText}>{item.content}</Text>
                    </View>
                  ) : null}

                  {/* 시간은 말풍선 밖 아래 — 버블 안에 넣으면 문장 끝과 뒤엉킨다. */}
                  <Text style={styles.messageMeta}>{meta}</Text>
                </View>
              );
            }}
          />
        )}
      </AppScreen>

      {/* 사진 크게 보기 — 배경 아무 곳이나 눌러 닫는다. */}
      <Modal
        visible={viewerUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUrl(null)}
        statusBarTranslucent
      >
        <Pressable style={styles.viewer} onPress={() => setViewerUrl(null)} accessibilityLabel="사진 닫기">
          {viewerUrl ? (
            <Image
              source={{ uri: viewerUrl }}
              style={styles.viewerImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/** 첨부 사진의 최대 크기. 세로로 긴 스크린샷이 화면을 통째로 먹지 않게 높이도 묶는다. */
const PHOTO_MAX_W = 240;
const PHOTO_MAX_H = 320;

/**
 * 채팅 사진 — **원본 비율 그대로** 그린다. 고정 정사각(220×220 cover)이던 시절 세로 사진은
 * 위아래가 잘리고 가로 사진은 좌우가 잘렸다(2026-08-11). `Image.getSize`로 실제 비율을 재고
 * 폭·높이 상한 안에서 그 비율을 지킨다. 비율을 알기 전에는 정사각 자리만 잡아 둔다.
 */
function ChatPhoto({ uri, onPress }: { uri: string; onPress: () => void }) {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setRatio(null);
    Image.getSize(
      uri,
      (w, h) => {
        if (alive && w > 0 && h > 0) setRatio(w / h);
      },
      () => {
        /* 못 재면 정사각 자리로 남는다 — 로드 실패는 이미지 자체가 안 보이는 것으로 드러난다. */
      },
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  // 가로형은 폭이 상한, 세로형은 높이가 상한을 정한다.
  const width = ratio ? (ratio >= 1 ? PHOTO_MAX_W : Math.min(PHOTO_MAX_W, PHOTO_MAX_H * ratio)) : PHOTO_MAX_W;
  const height = ratio ? width / ratio : PHOTO_MAX_W;

  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel="사진 크게 보기" onPress={onPress}>
      <Image
        source={{ uri }}
        style={[styles.photo, { width, height }]}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // 오프너 칩을 composer 바로 위에 — 탭→전송 동선을 한 썸존 안에 둔다(2026-07-27 감사).
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.x2,
    paddingHorizontal: space.x6,
    paddingBottom: space.x4,
  },
  emptyTitle: { ...type.heading, color: dark.text, textAlign: "center" },
  emptyBody: { ...type.body, color: dark.textMuted, textAlign: "center", marginBottom: space.x3 },
  openerCol: { alignSelf: "stretch", gap: space.x2 },
  openerChip: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    paddingVertical: space.x3,
    paddingHorizontal: space.x4,
  },
  openerText: { ...type.body, color: dark.text, textAlign: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.x1 },
  headerIcon: {
    width: control.minTouch,
    height: control.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  photo: { borderRadius: 16, backgroundColor: dark.surfaceHi },
  viewer: { flex: 1, backgroundColor: dark.scrimStrong, alignItems: "center", justifyContent: "center" },
  viewerImage: { width: "100%", height: "80%" },
  tips: { gap: space.x2, paddingBottom: space.x2 },
  tipsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tipsTitle: { ...type.caption, color: dark.label },
  tipChip: {
    borderWidth: 1,
    borderColor: dark.borderStrong,
    backgroundColor: dark.surface,
    borderRadius: 14,
    paddingVertical: space.x3,
    paddingHorizontal: space.x4,
  },
  tipText: { ...type.body, color: dark.text },
  suggestBtn: {
    width: control.minTouch,
    height: control.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  messages: { paddingVertical: space.x4, gap: space.x2 },
  // 한 줄 = 말풍선(또는 사진) + 그 아래 시간. 좌우 정렬로 화자를 나눈다.
  row: { maxWidth: "78%", gap: 4, marginVertical: space.x1 },
  rowMe: { alignSelf: "flex-end", alignItems: "flex-end" },
  rowPeer: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: space.x4,
    paddingVertical: space.x3,
  },
  // 내 말풍선 = 크림(브랜드 CTA와 같은 흰 톤), 상대 = 블러시 핑크. 둘 다 잉크 글씨.
  bubbleMe: { backgroundColor: dark.pill },
  bubblePeer: { backgroundColor: dark.accent },
  bubbleText: { ...type.body, color: dark.onPill },
  messageMeta: { ...type.caption, color: dark.textMuted },
  compose: { gap: space.x2 },
  composeRow: { flexDirection: "row", alignItems: "flex-end", gap: space.x2 },
  input: {
    flex: 1,
    minHeight: control.buttonHeight,
    borderWidth: doodle.border,
    borderColor: dark.border,
    backgroundColor: dark.fieldBg,
    ...doodle.radius.input,
    paddingHorizontal: space.x3,
    paddingVertical: space.x2,
    ...type.body,
    color: dark.text,
    maxHeight: 120,
  },
  sendBtn: {
    width: control.buttonHeight,
    height: control.buttonHeight,
    backgroundColor: dark.pill,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: dark.surfaceHi },
  pressed: { opacity: 0.68 },
});
