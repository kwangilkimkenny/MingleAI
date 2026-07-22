import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
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
import { DoodleCard } from "../../../src/components/Doodle";
import { DashedLine } from "../../../src/components/DoodleSvg";
import { EnterRow } from "../../../src/components/Motion";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { colors, control, doodle, layout, space, type } from "../../../src/lib/theme";
import {
  ContentColumn,
  InlineNotice,
  PageHeader,
  StateView,
} from "../../../src/components/Foundation";

export default function Proposals() {
  const clearance = useTabBarClearance();
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

  if (loading) {
    return <StateView title="프로포즈를 불러오고 있어요" loading />;
  }

  const proposals = tab === "received" ? received : sent;

  function statusLabel(status: ProposalView["status"]) {
    if (status === "accepted") return "매칭 완료";
    if (status === "declined") return "응답 종료";
    return tab === "sent" ? "답변 기다리는 중" : "답변 필요";
  }

  return (
    <View style={styles.container}>
      <ContentColumn style={styles.headerColumn}>
      <PageHeader title="프로포즈" description="호감은 명확하게, 결정은 서로의 속도로 나눠요." />
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
          <Text style={[styles.tabText, tab === "sent" && styles.tabTextActive]}>보낸 프로포즈</Text>
        </TouchableOpacity>
      </View>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      </ContentColumn>
      {proposals.length === 0 ? (
        <StateView
          title={tab === "received" ? "아직 받은 프로포즈가 없어요" : "아직 보낸 프로포즈가 없어요"}
          body="게임에서 함께 움직이고 대화한 뒤, 마음이 가는 상대에게 직접 선택을 전해보세요."
          actionLabel="게임 파티 찾기"
          onAction={() => router.push("/(app)/matching")}
        />
      ) : (
        <FlatList
          data={proposals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
          renderItem={({ item, index }) => (
            <EnterRow index={index}>
              <DoodleCard tone="paper" contentStyle={styles.cardInner}>
                <View style={styles.cardHeader}>
                  <PeerModerationMenu
                    peer={{ profileId: item.peer.profileId, name: item.peer.name }}
                    onBlocked={() => {
                      setReceived((prev) => prev.filter((p) => p.id !== item.id));
                      setSent((prev) => prev.filter((p) => p.id !== item.id));
                    }}
                  />
                </View>
                <View style={styles.peerInfo}>
                  <DoodleAvatar uri={item.peer.photoUrl} name={item.peer.name} size={54} />
                  <View style={styles.peerText}>
                    <Text style={styles.name}>
                      {item.peer.name} · {item.peer.age}
                    </Text>
                    <Text style={styles.meta}>{item.peer.occupation}</Text>
                    {item.peer.preferenceSummary ? (
                      <Text style={styles.summary}>{item.peer.preferenceSummary}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.divider}>
                  <DashedLine />
                </View>
                {tab === "received" && item.status === "pending" ? (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => onAccept(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.peer.name}님의 프로포즈 수락`}
                    >
                      <Text style={styles.acceptText}>수락하고 채팅 열기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => onDecline(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.peer.name}님의 프로포즈 거절`}
                    >
                      <Text style={styles.declineText}>거절</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>{statusLabel(item.status)}</Text>
                    <Text style={styles.statusHelp}>
                      {item.status === "pending"
                        ? "상대가 편한 시간에 답할 수 있어요"
                        : item.status === "accepted"
                          ? "채팅 탭에서 대화를 이어가세요"
                          : "상세한 거절 사유는 서로에게 공개하지 않아요"}
                    </Text>
                  </View>
                )}
              </DoodleCard>
            </EnterRow>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  headerColumn: { paddingHorizontal: layout.screenGutter, gap: space.x2 },
  tabs: {
    flexDirection: "row",
    marginTop: space.x1,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.grayLight,
  },
  tab: { minHeight: control.minTouch, flex: 1, alignItems: "center", justifyContent: "center" },
  tabActive: { borderBottomWidth: 3, borderBottomColor: colors.accent },
  tabText: { ...type.label, color: colors.grayDark },
  tabTextActive: { color: colors.ink },
  list: {
    width: "100%",
    maxWidth: layout.contentMax,
    alignSelf: "center",
    padding: layout.screenGutter,
    gap: space.x3,
  },
  cardInner: { padding: 14 },
  cardHeader: { alignItems: "flex-end" },
  peerInfo: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  peerText: { flex: 1 },
  name: { ...type.heading, fontSize: 18, lineHeight: 23, color: colors.ink },
  meta: { ...type.caption, color: colors.grayDark, marginTop: space.x1 },
  summary: { ...type.caption, color: colors.grayDark, marginTop: space.x1 },
  // SVG dashed hairline wrap (RN single-side dashed borders are broken natively); keeps the
  // 12px gap the old border-divider had before the action row.
  divider: { width: "100%", marginBottom: 12 },
  actions: { flexDirection: "row", gap: 8 },
  acceptBtn: {
    flex: 1,
    // 수락 = 이 화면의 primary 액션 — 팔레트 규칙상 잉크 블록이 아닌 코랄 포인트.
    backgroundColor: colors.accent,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    ...doodle.radius.button,
    minHeight: control.buttonHeight,
    paddingVertical: space.x2,
    alignItems: "center",
  },
  acceptText: { color: colors.onAccent, ...type.label },
  declineBtn: {
    flex: 1,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 8,
    minHeight: control.buttonHeight,
    paddingVertical: space.x2,
    alignItems: "center",
  },
  declineText: { ...type.label, color: colors.ink },
  statusRow: { gap: 3 },
  statusLabel: { ...type.label, color: colors.ink },
  statusHelp: { ...type.caption, color: colors.grayDark },
});
