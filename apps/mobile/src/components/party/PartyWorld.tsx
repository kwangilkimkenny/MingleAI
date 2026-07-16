/**
 * PartyWorld — 로비·어몽 공용 2D 월드. 컨테이너를 재고 worldFrame으로
 * 레터박스한 뒤 맵 아트/마커/시체/캐릭터를 절대배치한다. 캐릭터는 y 오름차순
 * 페인터 정렬(아래 있는 캐릭터가 앞). 입력(조이스틱/액션패드)은 부모 소관.
 */
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { PARTY_MAP, BALANCE_STATION_ID } from "@mingle/shared";
import type { Vec2 } from "../../lib/party-space";
import { worldFrame } from "../../lib/world-view";
import { colors } from "../../lib/theme";
import { DoodleCharacter, DoodleCorpse, CHAR_BOX } from "./DoodleCharacter";
import { PartyMapArt } from "./PartyMapArt";

export interface WorldCharacter {
  profileId: string;
  name: string;
  pos: Vec2;
  mine: boolean;
  walking: boolean;
  facing: 1 | -1;
  ghost?: boolean;
}

const TASK_MARKER = 16;

export function PartyWorld({
  characters,
  bodies = [],
  taskMarkers = [],
  showBalanceStation = false,
  clock,
  children,
}: {
  characters: WorldCharacter[];
  bodies?: { profileId: string; x: number; y: number }[];
  taskMarkers?: { id: string; x: number; y: number }[];
  showBalanceStation?: boolean;
  clock: number;
  children?: ReactNode;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const frame = worldFrame(box.w, box.h);
  const charSize = Math.min(56, Math.max(34, frame.height * 0.12));
  const balance = PARTY_MAP.stations.find((s) => s.id === BALANCE_STATION_ID)!;
  const sorted = [...characters].sort((a, b) => a.pos.y - b.pos.y);

  return (
    <View
      style={styles.letterbox}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {frame.width > 0 ? (
        <View
          style={[
            styles.floor,
            { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
          ]}
        >
          <PartyMapArt width={frame.width} height={frame.height} />

          {showBalanceStation ? (
            <View
              pointerEvents="none"
              style={[
                styles.balanceMarker,
                {
                  left: balance.x * frame.width - 7,
                  top: balance.y * frame.height - 7,
                },
              ]}
            />
          ) : null}

          {taskMarkers.map((t) => (
            <View
              key={t.id}
              pointerEvents="none"
              style={[
                styles.taskMarker,
                {
                  left: t.x * frame.width - TASK_MARKER / 2,
                  top: t.y * frame.height - TASK_MARKER / 2,
                },
              ]}
            />
          ))}

          {bodies.map((b) => (
            <View
              key={b.profileId}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: b.x * frame.width - 20,
                top: b.y * frame.height - 16,
              }}
            >
              <DoodleCorpse />
            </View>
          ))}

          {sorted.map((c) => (
            <View
              key={c.profileId}
              pointerEvents="none"
              style={{
                position: "absolute",
                // 발끝(pos)이 캐릭터 하단 중앙에 오도록 오프셋
                left: c.pos.x * frame.width - (charSize * CHAR_BOX.w) / 2,
                top: c.pos.y * frame.height - charSize * CHAR_BOX.h + charSize * 0.12,
              }}
            >
              <DoodleCharacter
                name={c.name}
                mine={c.mine}
                walking={c.walking}
                facing={c.facing}
                phase={clock}
                ghost={c.ghost}
                size={charSize}
              />
            </View>
          ))}

          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  letterbox: { flex: 1, backgroundColor: colors.fillDeep },
  floor: {
    position: "absolute",
    backgroundColor: colors.fill,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    overflow: "hidden",
  },
  taskMarker: {
    position: "absolute",
    width: TASK_MARKER,
    height: TASK_MARKER,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accentFill,
    borderRadius: 4,
  },
  balanceMarker: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.accent,
  },
});
