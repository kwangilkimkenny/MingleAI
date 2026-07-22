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
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";
import { colors, control, doodle, fonts, layout, space, type } from "../../../src/lib/theme";
import { InlineNotice, StateView } from "../../../src/components/Foundation";
import { CalendarDays, ChevronLeft, Send } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ChatRoom() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const myProfileId = useAuthStore((s) => s.profileId);
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
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
    return <StateView title="대화를 불러오고 있어요" loading />;
  }
  if (loadError) {
    return (
      <StateView
        title="대화를 열지 못했어요"
        body={loadError}
        actionLabel="채팅 목록으로"
        onAction={() => router.replace("/chats")}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <View style={styles.headerInner}>
        <Pressable
          onPress={() => router.replace("/chats")}
          accessibilityRole="button"
          accessibilityLabel="채팅 목록으로 돌아가기"
          style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}
        >
          <ChevronLeft color={colors.ink} size={24} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.headerPeer} accessibilityLabel={`${match?.peer.name ?? "상대"}님과의 채팅`}>
          <DoodleAvatar uri={match?.peer.photoUrl} name={match?.peer.name} size={36} />
          <View style={styles.headerText}>
            <Text accessibilityRole="header" style={styles.headerName} numberOfLines={1}>
              {match?.peer.name ?? "채팅"}
            </Text>
            <Text style={styles.headerStatus}>서로 수락한 안전한 대화</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {match != null && (
            <Pressable
              style={styles.datePlanBtn}
              onPress={() =>
                // new route — Expo Router typegen updates on next `expo start`
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                router.push({
                  pathname: "/(app)/date-plan/[matchId]" as any,
                  params: { matchId: match.matchId },
                })
              }
            >
              <CalendarDays color={colors.ink} size={18} />
              <Text style={styles.datePlanText}>만남 계획</Text>
            </Pressable>
          )}
          {match != null && (
            <PeerModerationMenu
              peer={{ profileId: match.peer.profileId, name: match.peer.name }}
              onBlocked={() => router.replace("/chats")}
            />
          )}
        </View>
        </View>
      </View>

      {/* Messages (inverted = newest at bottom) */}
      <FlatList
        inverted
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        ListEmptyComponent={
          <View style={styles.emptyConversation}>
            <Text style={styles.emptyTitle}>첫 인사를 건네보세요</Text>
            <Text style={styles.emptyBody}>게임에서 기억에 남은 순간을 이야기하면 자연스럽게 대화를 이어갈 수 있어요.</Text>
          </View>
        }
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
              <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextPeer]}>
                {item.content}
              </Text>
              <Text style={styles.messageMeta}>
                {formatTime(item.createdAt)}{isMe && item.readAt ? " · 읽음" : ""}
              </Text>
            </View>
          );
        }}
      />

      {/* Compose bar */}
      <View style={[styles.composeShell, { paddingBottom: Math.max(insets.bottom, space.x2) }]}>
      <View style={styles.compose}>
        {sendError ? <InlineNotice tone="error">{sendError}</InlineNotice> : null}
        <View style={styles.composeRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onChangeText}
          placeholder="메시지를 입력하세요"
          placeholderTextColor={colors.grayMid}
          multiline
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={onSend}
          accessibilityLabel="메시지 입력"
        />
        <Pressable
          style={({ pressed }) => [styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled, pressed && styles.pressed]}
          onPress={onSend}
          disabled={!text.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel={sending ? "메시지 전송 중" : "메시지 전송"}
          accessibilityState={{ disabled: !text.trim() || sending, busy: sending }}
        >
          <Send color={!text.trim() || sending ? colors.grayMid : colors.onAccent} size={20} />
        </Pressable>
        </View>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
    alignItems: "center",
  },
  headerInner: {
    width: "100%",
    maxWidth: 760,
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.x2,
  },
  headerIcon: { width: control.minTouch, height: control.minTouch, alignItems: "center", justifyContent: "center" },
  headerPeer: { flexDirection: "row", alignItems: "center", gap: space.x2, flex: 1, minWidth: 0 },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, color: colors.ink },
  headerStatus: { ...type.caption, color: colors.grayDark },
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.x1 },
  datePlanBtn: {
    minHeight: control.minTouch,
    flexDirection: "row",
    alignItems: "center",
    gap: space.x1,
    paddingHorizontal: space.x2,
  },
  datePlanText: { ...type.label, color: colors.ink },
  messages: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: layout.screenGutter,
    paddingVertical: space.x4,
    gap: space.x2,
  },
  emptyConversation: { alignItems: "center", gap: space.x2, paddingVertical: space.x10 },
  emptyTitle: { ...type.heading, color: colors.ink },
  emptyBody: { ...type.body, color: colors.grayDark, textAlign: "center", maxWidth: 360 },
  bubble: {
    maxWidth: "75%",
    ...doodle.radius.card,
    paddingHorizontal: space.x3,
    paddingVertical: space.x2,
    marginVertical: space.x1,
    borderWidth: doodle.border,
    borderColor: colors.ink,
  },
  bubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: colors.fillDeep,
  },
  bubblePeer: {
    alignSelf: "flex-start",
    backgroundColor: colors.paper,
  },
  bubbleText: { ...type.body },
  bubbleTextMe: { color: colors.ink },
  bubbleTextPeer: { color: colors.ink },
  messageMeta: { ...type.caption, color: colors.grayDark, marginTop: space.x1, textAlign: "right" },
  composeShell: {
    borderTopWidth: 2,
    borderTopColor: colors.ink,
    paddingTop: space.x2,
    paddingHorizontal: layout.screenGutter,
    backgroundColor: colors.paper,
    alignItems: "center",
  },
  compose: { width: "100%", maxWidth: 760, gap: space.x2 },
  composeRow: { flexDirection: "row", alignItems: "flex-end", gap: space.x2 },
  input: {
    flex: 1,
    minHeight: control.buttonHeight,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    ...doodle.radius.input,
    paddingHorizontal: space.x3,
    paddingVertical: space.x2,
    ...type.body,
    color: colors.ink,
    maxHeight: 120,
  },
  sendBtn: {
    width: control.buttonHeight,
    height: control.buttonHeight,
    backgroundColor: colors.accent,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.fillDeep },
  pressed: { opacity: 0.68 },
});
