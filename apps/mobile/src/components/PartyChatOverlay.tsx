/**
 * PartyChatOverlay — collapsible in-game party chat.
 * FAB(말풍선 아이콘, unread dot; 파티 화면에서는 우상단으로 재배치)를 탭하면 화면 중앙 카드 모달이
 * 뜬다(바텀시트 아님 — 가로 게임 월드 전환 이후 오버레이류는 중앙 카드로 통일). 메시지
 * 데이터와 전송 액션은 파티 화면이 소유(이동됨, 재작성 아님); 입력 텍스트·open/unread
 * 상태만 이 컴포넌트 로컬.
 */
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MessageCircle } from "lucide-react-native";
import type { PartyMessageView } from "@mingle/client-core";
import { WobbleBox, DashedLine } from "./DoodleSvg";
import { doodleInputStyle } from "./Doodle";
import { colors, control, doodle, fonts, space, type } from "../lib/theme";
import { useReducedMotion } from "react-native-reanimated";
import { useInitialAccessibilityFocus } from "../lib/accessibility";
import { hapticSelect } from "../lib/haptics";

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
  const { height, width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [seenCount, setSeenCount] = useState(messages.length);
  const historySeededRef = useRef(false);
  const focusRef = useInitialAccessibilityFocus(open);

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
    hapticSelect();
    onSend(content);
    setInput("");
  }

  const panelHeight = Math.min(500, Math.max(260, height - insets.top - insets.bottom - 32));
  const panelWidth = Math.min(520, Math.max(280, width - insets.left - insets.right - 32));

  return (
    <>
      {!hideFab ? (
        <Pressable
          onPress={() => setOpen(true)}
          style={[styles.fab, { bottom: 24 + insets.bottom }, fabStyle]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={hasUnread ? "채팅 열기, 읽지 않은 메시지 있음" : "채팅 열기"}
        >
          <MessageCircle color={colors.ink} size={24} strokeWidth={2.2} />
          {hasUnread ? <View style={styles.fabDot} /> : null}
        </Pressable>
      ) : null}

      <Modal visible={open} transparent animationType={reducedMotion ? "none" : "slide"} onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          accessibilityViewIsModal
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <WobbleBox
            radius={doodle.radius.card}
            bg="rgba(255,255,255,0.97)"
            style={[styles.panel, { width: panelWidth, height: panelHeight }]}
            contentStyle={styles.panelInner}
          >
            <View style={styles.header}>
              <View ref={focusRef} accessible accessibilityRole="header" accessibilityLabel="파티 채팅">
                <Text style={styles.title}>파티 채팅</Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]}
                accessibilityRole="button"
                accessibilityLabel="채팅 닫기"
              >
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>
            <DashedLine />
            {socketDown ? <Text style={styles.notice}>실시간 연결이 불안정해요</Text> : null}
            <ScrollView
              style={styles.list}
              contentContainerStyle={messages.length === 0 ? styles.emptyList : undefined}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
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
                accessibilityLabel="파티 채팅 메시지"
              />
              <Pressable
                style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!input.trim()}
                accessibilityRole="button"
                accessibilityLabel="메시지 전송"
                accessibilityState={{ disabled: !input.trim() }}
              >
                <Text style={[styles.sendText, !input.trim() && styles.sendTextDisabled]}>전송</Text>
              </Pressable>
            </View>
          </WobbleBox>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 28,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
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
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: space.x4,
    backgroundColor: "rgba(23,21,15,0.64)",
  },
  panel: { maxWidth: 520, maxHeight: 500 },
  panelInner: { flex: 1, padding: space.x4, gap: space.x2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  closeButton: { minWidth: control.minTouch, minHeight: control.minTouch, alignItems: "center", justifyContent: "center" },
  buttonPressed: { transform: [{ translateY: 2 }, { scale: 0.985 }], opacity: 0.9 },
  closeText: { ...type.label, color: colors.grayDark },
  notice: { ...type.caption, color: colors.danger },
  list: { flex: 1 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  empty: { ...type.body, color: colors.grayDark, textAlign: "center", paddingVertical: 8 },
  row: { gap: 2, paddingVertical: 4 },
  rowMine: { alignItems: "flex-end" },
  sender: { ...type.caption, color: colors.grayDark },
  content: { ...type.body, color: colors.ink },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, paddingVertical: 10 },
  sendBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    minHeight: control.buttonHeight,
    minWidth: 64,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.fillDeep },
  sendText: { ...type.label, color: colors.onAccent },
  sendTextDisabled: { color: colors.grayDark },
});
