import { useState } from "react";
import { colors, control, doodle, layout, shadow, space, type } from "../lib/theme";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { createBlock, ApiError } from "@mingle/client-core";
import { MoreHorizontal } from "lucide-react-native";
import { DoodleButton } from "./Doodle";
import { ConfirmDialog, InlineNotice } from "./Foundation";
import { useReducedMotion } from "react-native-reanimated";

export interface PeerModerationMenuProps {
  peer: { profileId: string; name: string };
  evidencePartyId?: string;
  onBlocked?: () => void;
}

export function PeerModerationMenu({ peer, evidencePartyId, onBlocked }: PeerModerationMenuProps) {
  const reducedMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openReport() {
    setMenuOpen(false);
    router.push({
      // new route — Expo Router typegen updates on next `expo start`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pathname: "/(app)/report/[profileId]" as any,
      params: evidencePartyId
        ? { profileId: peer.profileId, evidencePartyId }
        : { profileId: peer.profileId },
    });
  }

  async function onConfirmBlock() {
    setBusy(true);
    setError(null);
    try {
      await createBlock(peer.profileId);
      setConfirmOpen(false);
      onBlocked?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "차단하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  function openMenu() {
    setError(null);
    setMenuOpen(true);
  }

  return (
    <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${peer.name}님 신고 및 차단 메뉴`}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={openMenu}
    >
      <MoreHorizontal color={colors.ink} size={22} />
    </Pressable>
    <Modal
      visible={menuOpen}
      transparent
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={() => setMenuOpen(false)}
    >
        <View style={styles.modalRoot} accessibilityViewIsModal>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMenuOpen(false)}
            accessibilityLabel="안전 메뉴 닫기"
          />
          <View style={styles.sheet}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>{peer.name}님 안전 메뉴</Text>
            <Text style={styles.sheetBody}>불편한 상황이라면 신고하거나 이 사용자를 보이지 않게 할 수 있어요.</Text>
            {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
            <DoodleButton title="신고하기" onPress={openReport} />
            <DoodleButton
              title="차단하기"
              variant="danger"
              onPress={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
            />
            <DoodleButton title="취소" onPress={() => setMenuOpen(false)} />
          </View>
        </View>
    </Modal>
    <ConfirmDialog
        visible={confirmOpen}
        title={`${peer.name}님을 차단할까요?`}
        body="서로의 프로필과 대화가 보이지 않게 됩니다. 설정의 차단 목록에서 나중에 해제할 수 있어요."
        confirmLabel="차단하기"
        destructive
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={onConfirmBlock}
    />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: control.minTouch,
    height: control.minTouch,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  buttonPressed: { backgroundColor: colors.fill },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    padding: layout.screenGutter,
    backgroundColor: "rgba(42,34,40,0.55)",
  },
  sheet: {
    width: "100%",
    maxWidth: layout.modalMax,
    gap: space.x3,
    padding: space.x5,
    backgroundColor: colors.card,
    borderWidth: doodle.border,
    borderColor: colors.border,
    ...doodle.radius.card,
    ...shadow.elevated,
  },
  sheetTitle: { ...type.title, color: colors.heading },
  sheetBody: { ...type.body, color: colors.grayDark },
});
