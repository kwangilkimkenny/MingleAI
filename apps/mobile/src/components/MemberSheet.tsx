/**
 * MemberSheet — party member profile(s), rendered as a center card modal (bottom
 * sheet 아님 — 가로 게임 월드 전환 이후 오버레이류는 중앙 카드로 통일).
 *
 * Two entry points, one sheet:
 *  - 근처 유저 + ActionPad "사용" 버튼(프로필) → 그 멤버 detail로 바로 진입.
 *  - top-bar Users(멤버) button → opens a roster list; tapping a row drills into the exact
 *    same detail view, with a back arrow to return to the list.
 *
 * Propose/report state is owned by the party screen (moved, not rewritten) — this
 * component is presentational and calls back out for those actions.
 */
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PublicPartyParticipant } from "@mingle/shared";
import { WobbleBox, DashedLine } from "./DoodleSvg";
import { DoodleButton } from "./Doodle";
import { PeerModerationMenu } from "./PeerModerationMenu";
import { colors, doodle, fonts } from "../lib/theme";
import { initialOf } from "../lib/party-space";

export function MemberSheet({
  visible,
  members,
  initialProfileId,
  myProfileId,
  partyId,
  proposeSent,
  proposeErrors,
  onPropose,
  onBlocked,
  onClose,
}: {
  visible: boolean;
  /** Already filtered to hide blocked peers — caller owns that state. */
  members: PublicPartyParticipant[];
  /** null = open to the roster list; a profileId = open straight to that detail. */
  initialProfileId: string | null;
  myProfileId: string | null;
  partyId: string;
  proposeSent: Record<string, boolean>;
  proposeErrors: Record<string, string>;
  onPropose: (profileId: string) => void;
  onBlocked: (profileId: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(initialProfileId);
  const cameFromList = initialProfileId === null;

  // Re-sync the selection whenever the sheet is (re)opened with a new target.
  useEffect(() => {
    if (visible) setSelected(initialProfileId);
  }, [visible, initialProfileId]);

  const others = members.filter((m) => m.profileId !== myProfileId);
  const detail = selected ? (others.find((m) => m.profileId === selected) ?? null) : null;

  function handleBlocked(profileId: string) {
    onBlocked(profileId);
    if (cameFromList) setSelected(null);
    else onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="시트 닫기"
        />
        <WobbleBox
          radius={doodle.radius.card}
          bg={colors.paper}
          style={styles.panel}
          contentStyle={styles.panelInner}
        >
          <View style={styles.header}>
            {detail && cameFromList ? (
              <Pressable
                onPress={() => setSelected(null)}
                hitSlop={8}
                accessibilityLabel="목록으로"
              >
                <Text style={styles.backText}>‹ 목록</Text>
              </Pressable>
            ) : (
              <View style={styles.headerSpacer} />
            )}
            <Text style={styles.title} numberOfLines={1}>
              {detail ? detail.name : "파티 멤버"}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
              <Text style={styles.closeText}>닫기</Text>
            </Pressable>
          </View>
          <DashedLine />

          {detail ? (
            <View style={styles.detail}>
              <Text style={styles.name}>
                {detail.name} · {detail.age}
              </Text>
              <Text style={styles.meta}>{detail.occupation}</Text>
              {detail.preferenceSummary ? (
                <Text style={styles.summary}>{detail.preferenceSummary}</Text>
              ) : null}
              <View style={styles.actions}>
                <DoodleButton
                  title={proposeSent[detail.profileId] ? "프로포즈 완료" : "프로포즈 보내기"}
                  onPress={() => onPropose(detail.profileId)}
                  disabled={proposeSent[detail.profileId]}
                  variant="primary"
                />
                {proposeErrors[detail.profileId] ? (
                  <Text style={styles.error}>{proposeErrors[detail.profileId]}</Text>
                ) : null}
                <View style={styles.menuRow}>
                  <PeerModerationMenu
                    peer={{ profileId: detail.profileId, name: detail.name }}
                    evidencePartyId={partyId}
                    onBlocked={() => handleBlocked(detail.profileId)}
                  />
                </View>
              </View>
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {others.length === 0 ? (
                <Text style={styles.empty}>다른 멤버가 없어요</Text>
              ) : (
                others.map((m) => (
                  <Pressable
                    key={m.profileId}
                    style={styles.row}
                    onPress={() => setSelected(m.profileId)}
                    accessibilityLabel={`${m.name} 프로필 보기`}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initialOf(m.name)}</Text>
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>
                        {m.name} · {m.age}
                      </Text>
                      <Text style={styles.rowMeta}>{m.occupation}</Text>
                    </View>
                    {proposeSent[m.profileId] ? <Text style={styles.sentTag}>완료</Text> : null}
                  </Pressable>
                ))
              )}
            </ScrollView>
          )}
        </WobbleBox>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  panel: { width: "100%", maxWidth: 480, maxHeight: "88%" },
  panelInner: { padding: 16, gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerSpacer: { width: 40 },
  backText: { fontSize: 13, color: colors.grayDark, fontWeight: "600" },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
    flex: 1,
    textAlign: "center",
  },
  closeText: { fontSize: 13, color: colors.grayMid, fontWeight: "600" },

  detail: { gap: 6, paddingTop: 4 },
  name: { fontSize: 17, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 13, color: colors.grayDark },
  summary: { fontSize: 13, color: colors.grayMid },
  actions: { marginTop: 10, gap: 6 },
  error: { color: colors.accent, fontSize: 12 },
  menuRow: { alignItems: "flex-end", marginTop: 2 },

  list: { maxHeight: 360 },
  empty: { fontSize: 13, color: colors.grayMid, textAlign: "center", paddingVertical: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: colors.ink },
  rowInfo: { flex: 1, gap: 1 },
  rowName: { fontSize: 15, color: colors.ink, fontWeight: "600" },
  rowMeta: { fontSize: 12, color: colors.grayDark },
  sentTag: { fontSize: 11, color: colors.grayMid },
});
