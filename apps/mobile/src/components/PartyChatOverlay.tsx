/**
 * PartyChatOverlay — collapsible in-game party chat.
 * FAB(💬, unread dot; 파티 화면에서는 우상단으로 재배치)를 탭하면 화면 중앙 카드 모달이
 * 뜬다(바텀시트 아님 — 가로 게임 월드 전환 이후 오버레이류는 중앙 카드로 통일). 메시지
 * 데이터와 전송 액션은 파티 화면이 소유(이동됨, 재작성 아님); 입력 텍스트·open/unread
 * 상태만 이 컴포넌트 로컬.
 */
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PartyMessageView } from "@mingle/client-core";
import { WobbleBox, DashedLine } from "./DoodleSvg";
import { doodleInputStyle } from "./Doodle";
import { colors, doodle, fonts } from "../lib/theme";

export function PartyChatOverlay({
  messages,
  myProfileId,
  socketDown,
  senderName,
  onSend,
  hideFab = false,
  fabStyle,
}: {
  messages: PartyMessageView[];
  myProfileId: string | null;
  socketDown: boolean;
  /** Resolve a profileId to a display name (party screen already has the roster). */
  senderName: (profileId: string) => string;
  onSend: (content: string) => void;
  /** Hide the FAB entirely — e.g. while an Among Us meeting/result screen is up. */
  hideFab?: boolean;
  /** Extra style merged onto the FAB — e.g. reposition it away from the joystick/pad. */
  fabStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [seenCount, setSeenCount] = useState(messages.length);
  const historySeededRef = useRef(false);

  const hasUnread = !open && messages.length > seenCount;

  // Message history loads asynchronously — `messages` is still [] on mount, so seenCount
  // starts at 0. Without this, the first history fetch (arriving after mount) bumps
  // messages.length past that stale 0 and lights the unread dot for messages the user
  // never actually missed. Seed seenCount once, the first time history arrives non-empty,
  // so only messages that show up after entry count as unread.
  useEffect(() => {
    if (!historySeededRef.current && messages.length > 0) {
      historySeededRef.current = true;
      setSeenCount(messages.length);
    }
  }, [messages.length]);

  // Keep "seen" in sync with the latest message while the panel is open, so closing
  // it doesn't immediately show a stale unread dot.
  useEffect(() => {
    if (open) setSeenCount(messages.length);
  }, [open, messages.length]);

  // If a meeting/result screen takes over mid-chat, force the panel closed.
  useEffect(() => {
    if (hideFab) setOpen(false);
  }, [hideFab]);

  function handleSend() {
    const content = input.trim();
    if (!content) return;
    onSend(content);
    setInput("");
  }

  return (
    <>
      {!hideFab ? (
        <Pressable
          onPress={() => setOpen(true)}
          style={[styles.fab, { bottom: 24 + insets.bottom }, fabStyle]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="채팅 열기"
        >
          <Text style={styles.fabIcon}>💬</Text>
          {hasUnread ? <View style={styles.fabDot} /> : null}
        </Pressable>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
            accessibilityLabel="채팅 패널 닫기"
          />
          <WobbleBox
            radius={doodle.radius.card}
            bg="rgba(255,255,255,0.94)"
            style={styles.panel}
            contentStyle={styles.panelInner}
          >
            <View style={styles.header}>
              <Text style={styles.title}>파티 채팅</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8} accessibilityLabel="채팅 닫기">
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>
            <DashedLine />
            {socketDown ? <Text style={styles.notice}>실시간 연결이 불안정해요</Text> : null}
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {messages.length === 0 ? (
                <Text style={styles.empty}>첫 메시지를 보내보세요</Text>
              ) : (
                messages.slice(-30).map((m) => {
                  const mine = m.profileId === myProfileId;
                  return (
                    <View key={m.id} style={[styles.row, mine && styles.rowMine]}>
                      <Text style={styles.sender}>{mine ? "나" : senderName(m.profileId)}</Text>
                      <Text style={styles.content}>{m.content}</Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <DashedLine />
            <View style={styles.inputRow}>
              <TextInput
                style={[doodleInputStyle, styles.input]}
                value={input}
                onChangeText={setInput}
                placeholder="메시지 보내기"
                placeholderTextColor={colors.grayMid}
                maxLength={2000}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <Pressable style={styles.sendBtn} onPress={handleSend} hitSlop={6}>
                <Text style={styles.sendText}>전송</Text>
              </Pressable>
            </View>
          </WobbleBox>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  fabIcon: { fontSize: 24 },
  fabDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.paper,
  },
  modalRoot: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  panel: { width: "100%", maxWidth: 480, height: 300 },
  panelInner: { flex: 1, padding: 16, gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  closeText: { fontSize: 13, color: colors.grayMid, fontWeight: "600" },
  notice: { fontSize: 12, color: colors.grayMid },
  list: { flex: 1 },
  empty: { fontSize: 13, color: colors.grayMid, textAlign: "center", paddingVertical: 8 },
  row: { gap: 2, paddingVertical: 4 },
  rowMine: { alignItems: "flex-end" },
  sender: { fontSize: 11, color: colors.grayMid },
  content: { fontSize: 14, color: colors.ink },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, paddingVertical: 10 },
  sendBtn: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
  },
  sendText: { color: colors.paper, fontWeight: "700", fontSize: 13 },
});
