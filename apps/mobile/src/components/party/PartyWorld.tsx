/**
 * PartyWorld — 로비·어몽 공용 2D 월드. 월드를 뷰포트보다 크게 렌더하고 스크롤 카메라가
 * 내 캐릭터(mine)를 화면 중앙에 두도록 이동한다(레터박스 아님, 화면 전환 없음). 맵은 여러
 * 룸이 벽·문으로 이어진 넓은 공간. 캐릭터는 y 오름차순 페인터 정렬(아래가 앞). 입력
 * (조이스틱/액션패드 = children)은 스크롤되지 않는 화면 고정 오버레이.
 */
import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Navigation, Wrench } from "lucide-react-native";
import { PARTY_MAP, BALANCE_STATION_ID } from "@mingle/shared";
import type { Vec2 } from "../../lib/party-space";
import { worldCamera } from "../../lib/world-view";
import { colors, fonts } from "../../lib/theme";
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

const TASK_MARKER = 30;

export function PartyWorld({
  characters,
  bodies = [],
  taskMarkers = [],
  showBalanceStation = false,
  clock,
  children,
  safeInsets = { top: 0, right: 0, bottom: 0, left: 0 },
}: {
  characters: WorldCharacter[];
  bodies?: { profileId: string; x: number; y: number }[];
  taskMarkers?: { id: string; x: number; y: number; primary?: boolean }[];
  showBalanceStation?: boolean;
  clock: number;
  children?: ReactNode;
  safeInsets?: { top: number; right: number; bottom: number; left: number };
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const me = characters.find((c) => c.mine) ?? null;
  const cam = worldCamera(box.w, box.h, me ? me.pos : null);
  const charSize = Math.min(72, Math.max(52, cam.scale * 0.13));
  const balance = PARTY_MAP.stations.find((s) => s.id === BALANCE_STATION_ID)!;
  const sorted = [...characters].sort((a, b) => a.pos.y - b.pos.y);
  const primaryTask = taskMarkers.find((task) => task.primary) ?? taskMarkers[0] ?? null;
  const primaryScreen = primaryTask
    ? {
        x: primaryTask.x * cam.worldW - cam.offsetX,
        y: primaryTask.y * cam.worldH - cam.offsetY,
      }
    : null;
  const pointerPad = 42;
  const primaryOffscreen =
    primaryScreen !== null &&
    (primaryScreen.x < pointerPad + safeInsets.left ||
      primaryScreen.x > box.w - pointerPad - safeInsets.right ||
      primaryScreen.y < pointerPad + safeInsets.top ||
      primaryScreen.y > box.h - pointerPad - safeInsets.bottom);
  const pointerMinX = pointerPad + safeInsets.left;
  const pointerMaxX = Math.max(pointerMinX, box.w - pointerPad - safeInsets.right);
  const pointerMinY = pointerPad + 22 + safeInsets.top;
  const pointerMaxY = Math.max(pointerMinY, box.h - pointerPad - safeInsets.bottom);
  const pointerX = primaryScreen
    ? Math.min(Math.max(primaryScreen.x, pointerMinX), pointerMaxX)
    : 0;
  const pointerY = primaryScreen
    ? Math.min(Math.max(primaryScreen.y, pointerMinY), pointerMaxY)
    : 0;
  const pointerRotation = primaryScreen
    ? (Math.atan2(primaryScreen.y - pointerY, primaryScreen.x - pointerX) * 180) / Math.PI + 90
    : 0;

  return (
    <View
      style={styles.viewport}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {cam.worldW > 0 ? (
        <>
          <View
            style={[
              styles.world,
              { left: -cam.offsetX, top: -cam.offsetY, width: cam.worldW, height: cam.worldH },
            ]}
          >
            <PartyMapArt width={cam.worldW} height={cam.worldH} />

            {showBalanceStation ? (
              <View
                style={[
                  styles.balanceMarker,
                  {
                    left: balance.x * cam.worldW - 34,
                    top: balance.y * cam.worldH - 14,
                    pointerEvents: "none",
                  },
                ]}
              >
                <Text style={styles.balanceMarkerText}>밸런스</Text>
              </View>
            ) : null}

            {taskMarkers.map((t) => {
              const markerSize = t.primary ? 38 : TASK_MARKER;
              return (
                <View
                  key={t.id}
                  style={[
                    styles.taskMarker,
                    t.primary && styles.taskMarkerPrimary,
                    {
                      width: markerSize,
                      height: markerSize,
                      borderRadius: markerSize / 2,
                      left: t.x * cam.worldW - markerSize / 2,
                      top: t.y * cam.worldH - markerSize / 2,
                      pointerEvents: "none",
                    },
                  ]}
                >
                  <Wrench
                    color={t.primary ? colors.onAccent : colors.grayDark}
                    size={t.primary ? 20 : 15}
                    strokeWidth={3}
                  />
                </View>
              );
            })}

            {bodies.map((b) => (
              <View
                key={b.profileId}
                style={{
                  position: "absolute",
                  left: b.x * cam.worldW - 20,
                  top: b.y * cam.worldH - 16,
                  pointerEvents: "none",
                }}
              >
                <DoodleCorpse characterKey={b.profileId} size={charSize * 0.78} />
              </View>
            ))}

            {sorted.map((c) => (
              <View
                key={c.profileId}
                style={{
                  position: "absolute",
                  // 발끝(pos)이 캐릭터 하단 중앙에 오도록 오프셋
                  left: c.pos.x * cam.worldW - (charSize * CHAR_BOX.w) / 2,
                  top: c.pos.y * cam.worldH - charSize * CHAR_BOX.h + charSize * 0.12,
                  pointerEvents: "none",
                }}
              >
                <DoodleCharacter
                  characterKey={c.profileId}
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
          </View>

          {primaryOffscreen ? (
            <View
              style={[
                styles.taskPointer,
                {
                  left: pointerX - 25,
                  top: pointerY - 22,
                  pointerEvents: "none",
                },
              ]}
            >
              <Navigation
                color={colors.onAccent}
                fill={colors.onAccent}
                size={17}
                strokeWidth={2.5}
                style={{ transform: [{ rotate: `${pointerRotation}deg` }] }}
              />
              <View style={styles.taskPointerDot} />
            </View>
          ) : null}

          {/* 화면 고정 오버레이(조이스틱/액션패드) — 카메라 스크롤 영향 없음 */}
          {children}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 뷰포트: 큰 월드를 잘라내는 창.
  viewport: { flex: 1, backgroundColor: colors.fillDeep, overflow: "hidden" },
  world: { position: "absolute", backgroundColor: colors.fill },
  taskMarker: {
    position: "absolute",
    width: TASK_MARKER,
    height: TASK_MARKER,
    borderWidth: 2,
    borderColor: colors.grayDark,
    borderRadius: TASK_MARKER / 2,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  taskMarkerPrimary: {
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.accent,
    zIndex: 4,
  },
  taskPointer: {
    position: "absolute",
    width: 50,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 16,
  },
  taskPointerDot: {
    position: "absolute",
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.onAccent,
  },
  balanceMarker: {
    position: "absolute",
    width: 68,
    height: 28,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceMarkerText: { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 17, color: colors.accentDeep },
});
