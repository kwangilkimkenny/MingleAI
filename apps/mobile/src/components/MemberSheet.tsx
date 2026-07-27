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
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { PublicPartyParticipant } from "@mingle/shared";
import { WobbleBox, DashedLine } from "./DoodleSvg";
import { DoodleButton } from "./Doodle";
import { DoodleAvatar } from "./DoodleAvatar";
import { PartyDoodlePortrait } from "./party/DoodleCharacter";
import { PeerModerationMenu } from "./PeerModerationMenu";
import { colors, control, doodle, fonts, space, type } from "../lib/theme";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  onPropose: (profileId: string) => void | Promise<void>;
  onBlocked: (profileId: string) => void;
  onClose: () => void;
}) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(initialProfileId);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const cameFromList = initialProfileId === null;

  // Re-sync the selection whenever the sheet is (re)opened with a new target.
  useEffect(() => {
    if (visible) {
      setSelected(initialProfileId);
      setConfirming(false);
      setSending(false);
    }
  }, [visible, initialProfileId]);

  const others = members.filter((m) => m.profileId !== myProfileId);
  const detail = selected ? (others.find((m) => m.profileId === selected) ?? null) : null;

  function handleBlocked(profileId: string) {
    onBlocked(profileId);
    if (cameFromList) setSelected(null);
    else onClose();
  }

  async function confirmProposal(profileId: string) {
    setSending(true);
    await onPropose(profileId);
    setSending(false);
    setConfirming(false);
  }

  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? "none" : "slide"} onRequestClose={onClose}>
      <View style={styles.modalRoot} accessibilityViewIsModal>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="시트 닫기"
        />
        <WobbleBox
          radius={doodle.radius.card}
          bg={colors.paper}
          style={[
            styles.panel,
            {
              width: Math.min(
                520,
                Math.max(280, width - insets.left - insets.right - 40),
              ),
              height: Math.min(
                560,
                Math.max(280, height - insets.top - insets.bottom - 40),
              ),
            },
          ]}
          contentStyle={styles.panelInner}
        >
          <View style={styles.header}>
            {detail && cameFromList ? (
              <Pressable
                onPress={() => setSelected(null)}
                style={styles.headerButton}
                accessibilityRole="button"
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
            <Pressable onPress={onClose} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="닫기">
              <Text style={styles.closeText}>닫기</Text>
            </Pressable>
          </View>
          <DashedLine />

          {detail && confirming ? (
            <View style={styles.confirmation}>
              <ScrollView
                style={styles.confirmScroll}
                contentContainerStyle={styles.confirmScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {height >= 500 ? (
                  <DoodleAvatar uri={detail.photoUrl} name={detail.name} size={58} />
                ) : null}
                <Text style={styles.confirmTitle}>{detail.name}님께 프로포즈할까요?</Text>
                <Text style={styles.confirmBody}>
                  프로포즈는 호감을 전하는 선택이에요. 상대가 수락해야 1:1 채팅이 열립니다.
                </Text>
                <View style={styles.consentNote}>
                  <Text style={styles.consentTitle}>서로의 선택을 존중해요</Text>
                  <Text style={styles.consentBody}>
                    게임에서 나눈 분위기를 충분히 떠올린 뒤 결정해 주세요. 거절 여부는
                    발신자에게 자세히 공개되지 않아요.
                  </Text>
                </View>
              </ScrollView>
              <View style={styles.confirmActions}>
                <DoodleButton
                  title={sending ? "보내는 중…" : "프로포즈 보내기"}
                  onPress={() => void confirmProposal(detail.profileId)}
                  disabled={sending}
                  variant="primary"
                />
                <DoodleButton title="조금 더 알아보기" onPress={() => setConfirming(false)} />
              </View>
            </View>
          ) : detail ? (
            <ScrollView
              style={styles.detailScroll}
              contentContainerStyle={styles.detail}
              showsVerticalScrollIndicator
            >
              <View style={styles.profileHero}>
                <View style={styles.identityPair}>
                  <DoodleAvatar uri={detail.photoUrl} name={detail.name} size={64} />
                  <View style={styles.identityBadge}>
                    <PartyDoodlePortrait characterKey={detail.profileId} size={34} />
                  </View>
                </View>
                <View style={styles.profileCopy}>
                  <Text style={styles.name}>
                    {detail.name} · {detail.age}
                  </Text>
                  <Text style={styles.meta}>{detail.occupation}</Text>
                </View>
              </View>
              {detail.preferenceSummary ? (
                <Text style={styles.summary}>{detail.preferenceSummary}</Text>
              ) : null}
              <View style={styles.contextNote}>
                <Text style={styles.contextLabel}>게임에서 더 알아보세요</Text>
                <Text style={styles.contextCopy}>
                  가까이에서 함께 플레이하고 채팅한 뒤 결정해도 늦지 않아요.
                </Text>
              </View>
              <View style={styles.actions}>
                <DoodleButton
                  title={proposeSent[detail.profileId] ? "프로포즈 보냄" : "프로포즈 보내기"}
                  onPress={() => setConfirming(true)}
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
            </ScrollView>
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
                    accessibilityRole="button"
                    accessibilityLabel={`${m.name} 프로필 보기`}
                  >
                    <View style={styles.rowIdentity}>
                      <DoodleAvatar uri={m.photoUrl} name={m.name} size={42} />
                      <PartyDoodlePortrait characterKey={m.profileId} size={38} />
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
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: space.x5,
    backgroundColor: "rgba(23,21,15,0.64)",
  },
  panel: { maxWidth: 520, maxHeight: 560 },
  panelInner: { flex: 1, padding: space.x4, gap: space.x2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerSpacer: { width: control.minTouch },
  headerButton: { minWidth: control.minTouch, minHeight: control.minTouch, alignItems: "center", justifyContent: "center" },
  backText: { ...type.caption, color: colors.ink, fontFamily: fonts.bodySemibold },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 25,
    color: colors.ink,
    flex: 1,
    textAlign: "center",
  },
  closeText: { ...type.label, color: colors.ink },

  detailScroll: { flex: 1, minHeight: 0 },
  detail: { gap: space.x2, paddingTop: space.x1, paddingBottom: space.x2 },
  profileHero: { flexDirection: "row", alignItems: "center", gap: space.x3 },
  identityPair: { width: 76, height: 68 },
  identityBadge: { position: "absolute", right: 0, bottom: 0 },
  profileCopy: { flex: 1, gap: 2 },
  name: { ...type.heading, color: colors.ink },
  meta: { ...type.caption, color: colors.grayDark },
  summary: { ...type.body, color: colors.grayDark },
  contextNote: {
    marginTop: 8,
    backgroundColor: colors.fill,
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  contextLabel: { ...type.label, color: colors.ink },
  contextCopy: { ...type.caption, color: colors.grayDark },
  actions: { marginTop: 10, gap: 6 },
  error: { ...type.caption, color: colors.danger },
  menuRow: { alignItems: "flex-end", marginTop: 2 },

  list: { maxHeight: 360 },
  empty: { ...type.body, color: colors.grayDark, textAlign: "center", paddingVertical: space.x3 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: space.x2,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  rowIdentity: { flexDirection: "row", alignItems: "center", gap: 5 },
  rowInfo: { flex: 1, gap: 1 },
  rowName: { ...type.label, color: colors.ink },
  rowMeta: { ...type.caption, color: colors.grayDark },
  sentTag: { ...type.caption, color: colors.success },
  confirmation: { flex: 1, minHeight: 0, gap: 6 },
  confirmScroll: { flex: 1, minHeight: 0 },
  confirmScrollContent: { alignItems: "center", gap: 8, paddingTop: 2, paddingBottom: 6 },
  confirmTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    textAlign: "center",
  },
  confirmBody: { ...type.body, color: colors.grayDark, textAlign: "center" },
  consentNote: {
    alignSelf: "stretch",
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    borderRadius: 10,
    padding: 12,
    gap: 3,
    backgroundColor: colors.fill,
  },
  consentTitle: { ...type.label, color: colors.ink },
  consentBody: { ...type.caption, color: colors.grayDark },
  confirmActions: { flexShrink: 0, alignSelf: "stretch", gap: 6 },
});
