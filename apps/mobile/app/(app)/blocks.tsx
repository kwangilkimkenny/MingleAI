import { useCallback, useState } from "react";
import { FlatList } from "react-native";
import { useFocusEffect } from "expo-router";
import { getBlocks, removeBlock, ApiError, type PeerProfile } from "@mingle/client-core";
import { AppScreen } from "../../src/components/AppScreen";
import { ListRow, RowSeparator } from "../../src/components/ListRow";
import { DoodleButton } from "../../src/components/Doodle";
import { DoodleAvatar } from "../../src/components/DoodleAvatar";
import { ConfirmDialog, StateView } from "../../src/components/Foundation";

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

  let content;
  if (state === "loading") {
    content = <StateView title="차단 목록을 불러오고 있어요" loading dark />;
  } else if (state === "error") {
    content = (
      <StateView
        title="차단 목록을 불러오지 못했어요"
        actionLabel="다시 시도"
        onAction={load}
        dark
      />
    );
  } else if (blocks.length === 0) {
    content = (
      <StateView
        title="차단한 사용자가 없어요"
        body="불편한 사용자를 차단하면 이 목록에서 관리할 수 있어요."
        dark
      />
    );
  } else {
    content = (
      <FlatList
        style={{ flex: 1 }}
        data={blocks}
        keyExtractor={(item) => item.profileId}
        ItemSeparatorComponent={() => <RowSeparator gutter={0} dark />}
        renderItem={({ item }) => (
          <ListRow
            gutter={0}
            dark
            leading={<DoodleAvatar dark uri={item.photoUrl} name={item.name} size={44} />}
            title={item.name}
            subtitle={`${item.age} · ${item.occupation}`}
            trailing={
              <DoodleButton
                title="차단 해제"
                onPress={() => setUnblockTarget(item)}
                tone="dark"
              />
            }
          />
        )}
      />
    );
  }

  return (
    <AppScreen tone="dark" header={{ back: true, title: "차단 관리" }} body="plain">
      {content}
      <ConfirmDialog
        visible={unblockTarget !== null}
        title="차단을 해제할까요?"
        body={`${unblockTarget?.name ?? "이 사용자"}님의 프로필과 대화가 다시 보일 수 있어요.`}
        confirmLabel="차단 해제"
        busy={unblocking}
        onCancel={() => setUnblockTarget(null)}
        onConfirm={confirmUnblock}
      />
    </AppScreen>
  );
}
