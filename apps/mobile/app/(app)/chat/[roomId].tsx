import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
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

const INK = "#17150F";
const PAPER = "#FFFFFF";
const GRAY_LIGHT = "#D9D5CC";
const GRAY_MED = "#8A857C";

export default function ChatRoom() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const myProfileId = useAuthStore((s) => s.profileId);
  const token = useAuthStore((s) => s.token);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);

  const alive = useRef(true);
  const socketRef = useRef<MessengerSocketHandle | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isTypingRef = useRef(false);

  // Load initial history + peer info
  useEffect(() => {
    if (!roomId) return;
    alive.current = true;

    Promise.all([getRoomMessages(roomId), getMatches()])
      .then(([msgs, rooms]) => {
        if (!alive.current) return;
        setMessages(msgs);
        setMatch(rooms.find((r) => r.roomId === roomId) ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!alive.current) return;
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
    if (!content || !roomId) return;
    setText("");
    stopTyping();
    try {
      const msg = await sendMessage(roomId, content);
      // dedup: the socket echo (message:new) may arrive before the REST response;
      // guard absorbs the duplicate regardless of which arrives first.
      if (alive.current) setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]);
    } catch (e) {
      Alert.alert("전송 실패", e instanceof ApiError ? e.message : "메시지를 보내지 못했어요");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={INK} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerName}>{match?.peer.name ?? "채팅"}</Text>
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
              <Text style={styles.datePlanText}>데이트 플랜</Text>
            </Pressable>
          )}
          {match != null && (
            <PeerModerationMenu
              peer={{ profileId: match.peer.profileId, name: match.peer.name }}
              onBlocked={() => router.replace("/(app)/chats")}
            />
          )}
        </View>
      </View>

      {/* Messages (inverted = newest at bottom) */}
      <FlatList
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
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubblePeer]}>
              <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextPeer]}>
                {item.content}
              </Text>
              {isMe && item.readAt ? <Text style={styles.readLabel}>읽음</Text> : null}
            </View>
          );
        }}
      />

      {/* Compose bar */}
      <View style={styles.compose}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onChangeText}
          placeholder="메시지 입력..."
          placeholderTextColor={GRAY_MED}
          multiline
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={onSend}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={onSend}>
          <Text style={styles.sendText}>전송</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: INK,
  },
  headerName: { fontSize: 17, fontWeight: "700", color: INK },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  datePlanBtn: {
    borderWidth: 1.5,
    borderColor: INK,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  datePlanText: { fontSize: 13, fontWeight: "700", color: INK },
  messages: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  bubble: {
    maxWidth: "75%",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 2,
    borderWidth: 1.5,
    borderColor: INK,
  },
  bubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: INK,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  bubblePeer: {
    alignSelf: "flex-start",
    backgroundColor: PAPER,
  },
  bubbleText: { fontSize: 14 },
  bubbleTextMe: { color: PAPER },
  bubbleTextPeer: { color: INK },
  readLabel: { fontSize: 10, color: GRAY_LIGHT, marginTop: 2, textAlign: "right" },
  compose: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderTopWidth: 2,
    borderTopColor: INK,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: PAPER,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: INK,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: INK,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: INK,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendText: { color: PAPER, fontWeight: "700", fontSize: 14 },
});
