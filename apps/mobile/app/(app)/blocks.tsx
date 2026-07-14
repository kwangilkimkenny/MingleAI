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
import { BackButton } from "../../src/components/BackButton";
import { colors, doodle, fonts } from "../../src/lib/theme";

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
        <ActivityIndicator size="large" color={colors.ink} />
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
      <View style={styles.container}>
        <BackButton />
        <Text style={styles.title}>차단 목록</Text>
        <View style={styles.center}>
          <Text style={styles.msg}>차단한 사용자가 없어요.</Text>
        </View>
      </View>
    );
  }
  return (
    <FlatList
      style={styles.container}
      data={blocks}
      keyExtractor={(item) => item.profileId}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <>
          <BackButton />
          <Text style={styles.title}>차단 목록</Text>
        </>
      }
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
  container: { flex: 1, backgroundColor: colors.paper },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
    backgroundColor: colors.paper,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  list: { paddingVertical: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: doodle.border,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    padding: 12,
    marginHorizontal: 16,
    ...doodle.radius.card,
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 13, color: colors.grayDark },
  unblock: {
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  unblockText: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  msg: { fontSize: 15, color: colors.grayMid },
  retry: {
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryText: { color: colors.ink, fontWeight: "700" },
});
