import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { createBlock, ApiError } from "@mingle/client-core";

const INK = "#17150F";
const FILL = "#F1EFE9";

export interface PeerModerationMenuProps {
  peer: { profileId: string; name: string };
  evidencePartyId?: string;
  onBlocked?: () => void;
}

export function PeerModerationMenu({ peer, evidencePartyId, onBlocked }: PeerModerationMenuProps) {
  function openReport() {
    router.push({
      // new route — Expo Router typegen updates on next `expo start`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pathname: "/(app)/report/[profileId]" as any,
      params: evidencePartyId
        ? { profileId: peer.profileId, evidencePartyId }
        : { profileId: peer.profileId },
    });
  }

  function confirmBlock() {
    Alert.alert("차단", `${peer.name}님을 차단하시겠어요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "차단",
        style: "destructive",
        onPress: async () => {
          try {
            await createBlock(peer.profileId);
            onBlocked?.();
          } catch (e) {
            Alert.alert("오류", e instanceof ApiError ? e.message : "차단 실패");
          }
        },
      },
    ]);
  }

  function openMenu() {
    Alert.alert(peer.name, undefined, [
      { text: "신고하기", onPress: openReport },
      { text: "차단하기", style: "destructive", onPress: confirmBlock },
      { text: "취소", style: "cancel" },
    ]);
  }

  return (
    <Pressable
      accessibilityLabel="더보기"
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={openMenu}
    >
      <Text style={styles.glyph}>⋯</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  buttonPressed: { backgroundColor: FILL },
  glyph: { fontSize: 20, fontWeight: "700", color: INK },
});
