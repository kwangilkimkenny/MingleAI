import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Button,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getMatchmakingStatus, sendProposal, ApiError } from "@mingle/client-core";
import type { PublicParty, PartyMessageView, PartySocketHandle } from "@mingle/client-core";
import { getPartyMessages } from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";
import { PeerModerationMenu } from "../../../src/components/PeerModerationMenu";
import { openPartySocket } from "../../../src/lib/party-socket";

export default function PartyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
  const [chatInput, setChatInput] = useState("");
  const [socketDown, setSocketDown] = useState(false);
  const socketRef = useRef<PartySocketHandle | null>(null);

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
      onPresence: (p) => alive && setPresentCount(p.members.length),
      onError: () => alive && setSocketDown(true),
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
    return () => {
      alive = false;
      handle.leaveParty(id);
      handle.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token, party != null]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Button title="홈으로" onPress={() => router.replace("/(app)/home")} />
      </View>
    );
  }
  if (!party) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  async function onPropose(toProfileId: string) {
    if (!id) return;
    try {
      await sendProposal(id, toProfileId);
      setProposeSent((prev) => ({ ...prev, [toProfileId]: true }));
      setProposeErrors((prev) => ({ ...prev, [toProfileId]: "" }));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "프로포즈 실패";
      setProposeErrors((prev) => ({ ...prev, [toProfileId]: msg }));
    }
  }

  function onSendChat() {
    const content = chatInput.trim();
    if (!content || !id) return;
    socketRef.current?.sendChat(id, content);
    setChatInput("");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{party.name}</Text>
      <Text style={styles.sub}>곧 파티가 시작됩니다 · {party.participants.length}명</Text>
      {party.participants
        .filter((p) => !hidden[p.profileId])
        .map((p) => (
          <View key={p.profileId} style={styles.card}>
            <Text style={styles.name}>
              {p.name} · {p.age}
            </Text>
            <Text style={styles.meta}>{p.occupation}</Text>
            {p.preferenceSummary ? <Text style={styles.summary}>{p.preferenceSummary}</Text> : null}
            {p.profileId !== myProfileId ? (
              <>
                <View style={styles.proposeRow}>
                  <TouchableOpacity
                    style={[styles.proposeBtn, proposeSent[p.profileId] && styles.proposeBtnSent]}
                    disabled={proposeSent[p.profileId]}
                    onPress={() => onPropose(p.profileId)}
                  >
                    <Text
                      style={[
                        styles.proposeBtnText,
                        proposeSent[p.profileId] && styles.proposeBtnTextSent,
                      ]}
                    >
                      {proposeSent[p.profileId] ? "프로포즈 완료" : "프로포즈 보내기"}
                    </Text>
                  </TouchableOpacity>
                  {proposeErrors[p.profileId] ? (
                    <Text style={styles.proposeError}>{proposeErrors[p.profileId]}</Text>
                  ) : null}
                </View>
                <View style={styles.menuRow}>
                  <PeerModerationMenu
                    peer={{ profileId: p.profileId, name: p.name }}
                    evidencePartyId={id}
                    onBlocked={() => setHidden((prev) => ({ ...prev, [p.profileId]: true }))}
                  />
                </View>
              </>
            ) : null}
          </View>
        ))}
      <View style={styles.chatSection}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle}>파티 채팅</Text>
          <Text style={styles.presence}>{presentCount}명 접속 중</Text>
        </View>
        {socketDown ? <Text style={styles.chatNotice}>실시간 연결이 불안정해요</Text> : null}
        {messages.length === 0 ? (
          <Text style={styles.chatEmpty}>첫 메시지를 보내보세요</Text>
        ) : (
          messages.slice(-30).map((m) => {
            const sender = party.participants.find((p) => p.profileId === m.profileId);
            const mine = m.profileId === myProfileId;
            return (
              <View key={m.id} style={[styles.chatRow, mine && styles.chatRowMine]}>
                <Text style={styles.chatSender}>{mine ? "나" : (sender?.name ?? "??")}</Text>
                <Text style={styles.chatContent}>{m.content}</Text>
              </View>
            );
          })
        )}
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInputBox}
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="메시지 보내기"
            placeholderTextColor="#8A857C"
            maxLength={2000}
            onSubmitEditing={onSendChat}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.chatSendBtn} onPress={onSendChat}>
            <Text style={styles.chatSendText}>전송</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Button title="홈으로" onPress={() => router.replace("/(app)/home")} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 24 },
  container: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "600" },
  sub: { fontSize: 13, color: "#888", marginBottom: 8 },
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 12, gap: 4 },
  name: { fontSize: 16, fontWeight: "500" },
  meta: { fontSize: 13, color: "#555" },
  summary: { fontSize: 13, color: "#777" },
  error: { color: "#17150F", textAlign: "center" },
  proposeRow: { marginTop: 8, gap: 4 },
  proposeBtn: {
    borderWidth: 2,
    borderColor: "#17150F",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  proposeBtnSent: { backgroundColor: "#17150F" },
  proposeBtnText: { color: "#17150F", fontWeight: "700", fontSize: 13 },
  proposeBtnTextSent: { color: "#FFFFFF" },
  proposeError: { color: "#17150F", fontSize: 12 },
  menuRow: { alignItems: "flex-end", marginTop: 4 },
  chatSection: { borderWidth: 2, borderColor: "#17150F", borderRadius: 10, padding: 12, gap: 8 },
  chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatTitle: { fontSize: 15, fontWeight: "700", color: "#17150F" },
  presence: { fontSize: 12, color: "#45413A" },
  chatNotice: { fontSize: 12, color: "#8A857C" },
  chatEmpty: { fontSize: 13, color: "#8A857C", textAlign: "center", paddingVertical: 8 },
  chatRow: { gap: 2, paddingVertical: 2 },
  chatRowMine: { alignItems: "flex-end" },
  chatSender: { fontSize: 11, color: "#8A857C" },
  chatContent: { fontSize: 14, color: "#17150F" },
  chatInputRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  chatInputBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D9D5CC",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#17150F",
  },
  chatSendBtn: {
    backgroundColor: "#17150F",
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  chatSendText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
});
