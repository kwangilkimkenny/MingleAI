import { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import {
  getReceivedProposals,
  getSentProposals,
  acceptProposal,
  declineProposal,
  ApiError,
  type ProposalView,
} from "@mingle/client-core";
import { PeerModerationMenu } from "../../../src/components/PeerModerationMenu";
import { DoodleAvatar } from "../../../src/components/DoodleAvatar";
import { DoodleCard, DoodleButton } from "../../../src/components/Doodle";
import { EnterRow } from "../../../src/components/Motion";
import { AppScreen } from "../../../src/components/AppScreen";
import { ListRow } from "../../../src/components/ListRow";
import { InlineNotice, StateView } from "../../../src/components/Foundation";
import { control, dark, space, type } from "../../../src/lib/theme";

export default function Proposals() {
  const [received, setReceived] = useState<ProposalView[]>([]);
  const [sent, setSent] = useState<ProposalView[]>([]);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    Promise.all([getReceivedProposals(), getSentProposals()])
      .then(([receivedList, sentList]) => {
        if (!alive.current) return;
        setReceived(receivedList);
        setSent(sentList);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive.current) return;
        setError(e instanceof ApiError ? e.message : "불러오기 실패");
        setLoading(false);
      });
    return () => {
      alive.current = false;
    };
  }, []);

  async function onAccept(id: string) {
    try {
      const res = await acceptProposal(id);
      if (!alive.current) return;
      setReceived((prev) => prev.map((p) => (p.id === id ? { ...p, status: "accepted" } : p)));
      router.push({ pathname: "/(app)/chat/[roomId]", params: { roomId: res.roomId } });
    } catch (e) {
      if (alive.current) setError(e instanceof ApiError ? e.message : "수락 실패");
    }
  }

  async function onDecline(id: string) {
    try {
      await declineProposal(id);
      if (!alive.current) return;
      setReceived((prev) => prev.map((p) => (p.id === id ? { ...p, status: "declined" } : p)));
    } catch (e) {
      if (alive.current) setError(e instanceof ApiError ? e.message : "거절 실패");
    }
  }

  const proposals = tab === "received" ? received : sent;

  function statusLabel(status: ProposalView["status"]) {
    if (status === "accepted") return "매칭 완료";
    if (status === "declined") return "응답 종료";
    return tab === "sent" ? "답변 기다리는 중" : "답변 필요";
  }

  function statusHelp(status: ProposalView["status"]) {
    if (status === "accepted") return "채팅 탭에서 대화를 이어가세요";
    if (status === "declined") return "상세한 거절 사유는 서로에게 공개하지 않아요";
    return "상대가 편한 시간에 답할 수 있어요";
  }

  return (
    <AppScreen tabScreen tone="dark" header={{ back: true, title: "프로포즈" }} body="plain">
      {loading ? (
        <StateView title="프로포즈를 불러오고 있어요" loading dark />
      ) : (
        <>
          <View style={styles.tabs} accessibilityRole="tablist">
            <TouchableOpacity
              style={[styles.tab, tab === "received" && styles.tabActive]}
              onPress={() => setTab("received")}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === "received" }}
            >
              <Text style={[styles.tabText, tab === "received" && styles.tabTextActive]}>
                받은 프로포즈 {received.filter((p) => p.status === "pending").length}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === "sent" && styles.tabActive]}
              onPress={() => setTab("sent")}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === "sent" }}
            >
              <Text style={[styles.tabText, tab === "sent" && styles.tabTextActive]}>
                보낸 프로포즈
              </Text>
            </TouchableOpacity>
          </View>
          {error ? (
            <View style={styles.notice}>
              <InlineNotice tone="error" dark>
                {error}
              </InlineNotice>
            </View>
          ) : null}
          {proposals.length === 0 ? (
            <StateView
              dark
              title={
                tab === "received" ? "아직 받은 프로포즈가 없어요" : "아직 보낸 프로포즈가 없어요"
              }
              body="블라인드 데이트에서 대화한 뒤, 마음이 가는 상대에게 직접 선택을 전해보세요."
              actionLabel="블라인드 데이트 시작"
              onAction={() => router.push("/(app)/speed-date")}
            />
          ) : (
            <FlatList
              style={styles.flex}
              data={proposals}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item, index }) => (
                <EnterRow index={index}>
                  <DoodleCard tone="dark" contentStyle={styles.card}>
                    <ListRow
                      dark
                      gutter={0}
                      leading={
                        <DoodleAvatar uri={item.peer.photoUrl} name={item.peer.name} size={44} />
                      }
                      title={`${item.peer.name} · ${item.peer.age}`}
                      subtitle={item.peer.occupation}
                      trailing={
                        <PeerModerationMenu
                          dark
                          peer={{ profileId: item.peer.profileId, name: item.peer.name }}
                          onBlocked={() => {
                            setReceived((prev) => prev.filter((p) => p.id !== item.id));
                            setSent((prev) => prev.filter((p) => p.id !== item.id));
                          }}
                        />
                      }
                    />
                    {item.peer.preferenceSummary ? (
                      <Text style={styles.summary} numberOfLines={2}>
                        {item.peer.preferenceSummary}
                      </Text>
                    ) : null}
                    {tab === "received" && item.status === "pending" ? (
                      <View style={styles.actions}>
                        <View style={styles.actionItem}>
                          <DoodleButton
                            title="수락하고 채팅 열기"
                            variant="primary"
                            tone="dark"
                            onPress={() => onAccept(item.id)}
                          />
                        </View>
                        <View style={styles.actionItem}>
                          <DoodleButton title="거절" tone="dark" onPress={() => onDecline(item.id)} />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>{statusLabel(item.status)}</Text>
                        <Text style={styles.statusHelp}>{statusHelp(item.status)}</Text>
                      </View>
                    )}
                  </DoodleCard>
                </EnterRow>
              )}
            />
          )}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: dark.line,
  },
  tab: { minHeight: control.minTouch, flex: 1, alignItems: "center", justifyContent: "center" },
  tabActive: { borderBottomWidth: 3, borderBottomColor: dark.accent },
  tabText: { ...type.label, color: dark.textMuted },
  tabTextActive: { color: dark.text },
  notice: { marginTop: space.x3 },
  list: { paddingTop: space.x3, gap: space.x3 },
  card: { paddingHorizontal: space.x4, paddingVertical: space.x2, gap: space.x2 },
  summary: { ...type.caption, color: dark.textMuted },
  actions: { flexDirection: "row", gap: space.x2 },
  actionItem: { flex: 1 },
  statusRow: { gap: 2 },
  statusLabel: { ...type.label, color: dark.text },
  statusHelp: { ...type.caption, color: dark.textMuted },
});
