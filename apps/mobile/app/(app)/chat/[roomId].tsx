import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
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
} from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";
import { openMessengerSocket } from "../../../src/lib/messenger-socket";
import { PeerModerationMenu } from "../../../src/components/PeerModerationMenu";
import { AppScreen } from "../../../src/components/AppScreen";
import { colors, control, dark, doodle, space, type } from "../../../src/lib/theme";
import { InlineNotice, StateView } from "../../../src/components/Foundation";
import { CalendarDays, Send } from "lucide-react-native";

/** 블라인드 데이트 매치 직후의 첫 메시지 후보 — 방금 대화한 사이라는 맥락에 맞춘 오프너. */
const OPENERS = [
  "아까 대화 즐거웠어요. 이어서 얘기해요!",
  "목소리가 기억에 남아요. 다시 만나서 반가워요 :)",
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
        setMessages(msgs);
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
            setMessages((prev) => {
              const seen = new Set(prev.map((m) => m.id));
              const added = fresh.filter((m) => !seen.has(m.id));
              return added.length === 0 ? prev : [...added, ...prev];
            });
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

  async function onSend() {
    const content = text.trim();
    if (!content || !roomId || sending) return;
    setSending(true);
    setSendError(null);
    stopTyping();
    try {
      const msg = await sendMessage(roomId, content);
      // dedup: the socket echo (message:new) may arrive before the REST response;
      // guard absorbs the duplicate regardless of which arrives first.
      if (alive.current)
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]));
      setText("");
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : "메시지를 보내지 못했어요. 다시 시도해 주세요.");
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
      <View style={styles.composeRow}>
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
                <View style={[styles.bubble, styles.bubblePeer]}>
                  <Text style={[styles.bubbleText, styles.bubbleTextPeer]}>···</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const isMe = item.senderProfileId === myProfileId;
              return (
                <View
                  style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubblePeer]}
                  accessibilityLabel={`${isMe ? "내 메시지" : `${match?.peer.name ?? "상대"}의 메시지`}, ${item.content}, ${formatTime(item.createdAt)}${isMe && item.readAt ? ", 읽음" : ""}`}
                >
                  <Text
                    style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextPeer]}
                  >
                    {item.content}
                  </Text>
                  <Text style={[styles.messageMeta, isMe && styles.messageMetaMe]}>
                    {formatTime(item.createdAt)}
                    {isMe && item.readAt ? " · 읽음" : ""}
                  </Text>
                </View>
              );
            }}
          />
        )}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.x2,
    paddingHorizontal: space.x6,
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
  messages: { paddingVertical: space.x4, gap: space.x2 },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: space.x3,
    paddingVertical: space.x2,
    marginVertical: space.x1,
  },
  bubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentStrong,
  },
  bubblePeer: {
    alignSelf: "flex-start",
    backgroundColor: dark.surface,
    borderWidth: doodle.border,
    borderColor: dark.border,
  },
  bubbleText: { ...type.body },
  bubbleTextMe: { color: colors.onAccent },
  bubbleTextPeer: { color: dark.text },
  messageMeta: { ...type.caption, color: dark.textMuted, marginTop: space.x1, textAlign: "right" },
  messageMetaMe: { color: "rgba(255,255,255,0.85)" },
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
