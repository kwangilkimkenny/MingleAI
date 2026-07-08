import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { getBlocks, removeBlock, ApiError, type PeerProfile } from "@mingle/client-core";

const INK = "#17150F";
const PAPER = "#FFFFFF";
const GRAY_MED = "#8A857C";
const GRAY_DARK = "#45413A";

type LoadState = "loading" | "ready" | "error";

export default function BlocksScreen() {
  const [blocks, setBlocks] = useState<PeerProfile[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(() => {
    let alive = true;
    setState("loading");
    getBlocks()
      .then((rows) => {
        if (alive) {
          setBlocks(rows);
          setState("ready");
        }
      })
      .catch(() => {
        if (alive) setState("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(load);

  function onUnblock(peer: PeerProfile) {
    Alert.alert("차단 해제", `${peer.name}님의 차단을 해제할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "해제",
        onPress: async () => {
          try {
            await removeBlock(peer.profileId);
            setBlocks((prev) => prev.filter((b) => b.profileId !== peer.profileId));
          } catch (e) {
            Alert.alert("오류", e instanceof ApiError ? e.message : "차단 해제 실패");
          }
        },
      },
    ]);
  }

  if (state === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={INK} />
      </View>
    );
  }
  if (state === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>차단 목록을 불러오지 못했어요.</Text>
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }
  if (blocks.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>차단한 사용자가 없어요.</Text>
      </View>
    );
  }
  return (
    <FlatList
      style={styles.container}
      data={blocks}
      keyExtractor={(item) => item.profileId}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.name}>
              {item.name} · {item.age}
            </Text>
            <Text style={styles.meta}>{item.occupation}</Text>
          </View>
          <Pressable style={styles.unblock} onPress={() => onUnblock(item)}>
            <Text style={styles.unblockText}>차단 해제</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
    backgroundColor: PAPER,
  },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 10,
    padding: 12,
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: "700", color: INK },
  meta: { fontSize: 13, color: GRAY_DARK },
  unblock: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  unblockText: { color: INK, fontWeight: "700", fontSize: 13 },
  msg: { fontSize: 15, color: GRAY_MED },
  retry: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryText: { color: INK, fontWeight: "700" },
});
