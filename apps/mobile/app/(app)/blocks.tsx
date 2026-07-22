import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { getBlocks, removeBlock, ApiError, type PeerProfile } from "@mingle/client-core";
import { colors, control, doodle, layout, space, type } from "../../src/lib/theme";
import { DoodleAvatar } from "../../src/components/DoodleAvatar";
import {
  ConfirmDialog,
  ContentColumn,
  PageHeader,
  StateView,
} from "../../src/components/Foundation";

type LoadState = "loading" | "ready" | "error";

export default function BlocksScreen() {
  const [blocks, setBlocks] = useState<PeerProfile[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [unblockTarget, setUnblockTarget] = useState<PeerProfile | null>(null);
  const [unblocking, setUnblocking] = useState(false);

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

  async function confirmUnblock() {
    if (!unblockTarget) return;
    setUnblocking(true);
    try {
      await removeBlock(unblockTarget.profileId);
      setBlocks((prev) => prev.filter((b) => b.profileId !== unblockTarget.profileId));
      setUnblockTarget(null);
    } catch (e) {
      setState("error");
      if (e instanceof ApiError) console.warn(e.message);
    } finally {
      setUnblocking(false);
    }
  }

  if (state === "loading") {
    return <StateView title="차단 목록을 불러오고 있어요" loading />;
  }
  if (state === "error") {
    return <StateView title="차단 목록을 불러오지 못했어요" actionLabel="다시 시도" onAction={load} />;
  }
  if (blocks.length === 0) {
    return (
      <View style={styles.container}>
        <ContentColumn style={styles.headerColumn}>
          <PageHeader back title="차단 목록" description="차단한 사용자는 프로필과 대화에서 서로 보이지 않아요." />
        </ContentColumn>
        <StateView title="차단한 사용자가 없어요" body="불편한 사용자를 차단하면 이 목록에서 관리할 수 있어요." />
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
        <PageHeader back title="차단 목록" description="차단한 사용자는 프로필과 대화에서 서로 보이지 않아요." />
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <DoodleAvatar uri={item.photoUrl} name={item.name} size={48} />
          <View style={styles.info}>
            <Text style={styles.name}>
              {item.name} · {item.age}
            </Text>
            <Text style={styles.meta}>{item.occupation}</Text>
          </View>
          <Pressable
            style={styles.unblock}
            onPress={() => setUnblockTarget(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}님 차단 해제`}
          >
            <Text style={styles.unblockText}>차단 해제</Text>
          </Pressable>
        </View>
      )}
      ListFooterComponent={
        <ConfirmDialog
          visible={unblockTarget !== null}
          title="차단을 해제할까요?"
          body={`${unblockTarget?.name ?? "이 사용자"}님의 프로필과 대화가 다시 보일 수 있어요.`}
          confirmLabel="차단 해제"
          busy={unblocking}
          onCancel={() => setUnblockTarget(null)}
          onConfirm={confirmUnblock}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  headerColumn: { paddingHorizontal: layout.screenGutter },
  list: {
    width: "100%",
    maxWidth: layout.contentMax,
    alignSelf: "center",
    paddingHorizontal: layout.screenGutter,
    paddingBottom: space.x8,
    gap: space.x3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: doodle.border,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    gap: space.x3,
    padding: space.x3,
    ...doodle.radius.card,
  },
  info: { flex: 1, gap: space.x1 },
  name: { ...type.label, color: colors.ink },
  meta: { ...type.caption, color: colors.grayDark },
  unblock: {
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 8,
    minHeight: control.minTouch,
    justifyContent: "center",
    paddingVertical: space.x2,
    paddingHorizontal: 12,
  },
  unblockText: { ...type.label, color: colors.ink },
});
