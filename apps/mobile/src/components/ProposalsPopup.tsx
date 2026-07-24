/**
 * ProposalsPopup — 홈 우상단 하트에서 여는 프로포즈 팝업(반투명 다크 바텀시트).
 *
 * 기존 프로포즈 페이지(`app/(app)/(tabs)/proposals.tsx`)의 데이터·로직(받은/보낸 탭·수락/거절·
 * 모더레이션·상태)을 그대로 이식하고, 페이지 셸(AppScreen) 대신 투명 Modal + 하단 시트로 감쌌다.
 * 데이터 로드는 `visible`가 true가 될 때마다 수행하고, 수락 시 채팅으로 push한 뒤 onClose()로 닫는다.
 */
import { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Pressable, Modal, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import {
  getReceivedProposals,
  getSentProposals,
  acceptProposal,
  declineProposal,
  ApiError,
  type ProposalView,
} from "@mingle/client-core";
import { PeerModerationMenu } from "./PeerModerationMenu";
import { DoodleAvatar } from "./DoodleAvatar";
import { DoodleCard, DoodleButton } from "./Doodle";
import { EnterRow } from "./Motion";
import { ListRow } from "./ListRow";
import { InlineNotice, StateView } from "./Foundation";
import { colors, control, dark, space, type } from "../lib/theme";
import { serifFont } from "../lib/serif";

export function ProposalsPopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [received, setReceived] = useState<ProposalView[]>([]);
  const [sent, setSent] = useState<ProposalView[]>([]);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 팝업이 열릴 때마다 최신 프로포즈를 다시 불러온다.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getReceivedProposals(), getSentProposals()])
      .then(([receivedList, sentList]) => {
        if (cancelled) return;
        setReceived(receivedList);
        setSent(sentList);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "불러오기 실패");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  async function onAccept(id: string) {
    try {
      const res = await acceptProposal(id);
      if (!mounted.current) return;
      setReceived((prev) => prev.map((p) => (p.id === id ? { ...p, status: "accepted" } : p)));
      onClose();
      router.push({ pathname: "/(app)/chat/[roomId]", params: { roomId: res.roomId } });
    } catch (e) {
      if (mounted.current) setError(e instanceof ApiError ? e.message : "수락 실패");
    }
  }

  async function onDecline(id: string) {
    try {
      await declineProposal(id);
      if (!mounted.current) return;
      setReceived((prev) => prev.map((p) => (p.id === id ? { ...p, status: "declined" } : p)));
    } catch (e) {
      if (mounted.current) setError(e instanceof ApiError ? e.message : "거절 실패");
    }
  }

  const proposals = tab === "received" ? received : sent;
  const pendingReceived = received.filter((p) => p.status === "pending").length;

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
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="프로포즈 닫기" />
      <View style={styles.root} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.x4 }]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.headerTitle}>
              프로포즈
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="닫기"
              hitSlop={8}
              style={styles.closeButton}
            >
              <X color={dark.textMuted} size={24} />
            </TouchableOpacity>
          </View>

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
                  <View style={styles.tabInner}>
                    <Text style={[styles.tabText, tab === "received" && styles.tabTextActive]}>
                      받은 프로포즈
                    </Text>
                    {pendingReceived > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{pendingReceived}</Text>
                      </View>
                    ) : null}
                  </View>
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
                    tab === "received"
                      ? "아직 받은 프로포즈가 없어요"
                      : "아직 보낸 프로포즈가 없어요"
                  }
                  body="블라인드 데이트에서 대화한 뒤, 마음이 가는 상대에게 직접 선택을 전해보세요."
                  actionLabel="블라인드 데이트 시작"
                  onAction={() => {
                    onClose();
                    router.push("/(app)/speed-date");
                  }}
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
                              <DoodleButton
                                title="거절"
                                tone="dark"
                                onPress={() => onDecline(item.id)}
                              />
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, flexShrink: 1 },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10,7,5,0.55)",
  },
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "80%",
    backgroundColor: "rgba(26,20,15,0.94)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: dark.border,
    paddingHorizontal: space.x4,
    paddingTop: space.x2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: control.minTouch,
  },
  headerTitle: { ...type.title, fontFamily: serifFont, color: dark.text },
  closeButton: {
    width: control.minTouch,
    height: control.minTouch,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -space.x2,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: dark.line,
    marginTop: space.x1,
  },
  tab: { minHeight: control.minTouch, flex: 1, alignItems: "center", justifyContent: "center" },
  tabInner: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  tabActive: { borderBottomWidth: 3, borderBottomColor: dark.accent },
  tabText: { ...type.label, color: dark.textMuted },
  tabTextActive: { color: dark.text },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: colors.accentStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { ...type.caption, color: colors.onAccent, fontFamily: type.label.fontFamily },
  notice: { marginTop: space.x3 },
  list: { paddingTop: space.x3, paddingBottom: space.x2, gap: space.x3 },
  card: { paddingHorizontal: space.x4, paddingVertical: space.x2, gap: space.x2 },
  summary: { ...type.caption, color: dark.textMuted },
  actions: { flexDirection: "row", gap: space.x2 },
  actionItem: { flex: 1 },
  statusRow: { gap: 2 },
  statusLabel: { ...type.label, color: dark.text },
  statusHelp: { ...type.caption, color: dark.textMuted },
});
