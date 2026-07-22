/**
 * Joystick — 좌하단 고정 가상 스틱. PanResponder(dx/dy는 grant 기준)라서
 * RN Web에서도 동작한다(locationX 불사용). grant 지점을 스틱 중심으로 취급하는
 * "고정 베이스 + 마이크로 플로팅" 방식 — 베이스 어디를 눌러도 그 지점이 기준.
 * 이동은 onVector로만 나간다(부모 velRef → rAF 적분). 노브 상태는 로컬 렌더 전용.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { wobbleRect } from "../../lib/doodle-path";
import { stickVector, knobOffset, STICK_RADIUS } from "../../lib/joystick";
import type { Vec2 } from "../../lib/party-space";
import { colors } from "../../lib/theme";

const BASE = STICK_RADIUS * 2 + 32; // 120
const KNOB = 48;
const round = (r: number) => ({
  borderTopLeftRadius: r,
  borderTopRightRadius: r,
  borderBottomRightRadius: r,
  borderBottomLeftRadius: r,
});
const BASE_PATH = wobbleRect(BASE - 4, BASE - 4, round((BASE - 4) / 2), 11, { amp: 1.4, step: 10 });
const KNOB_PATH = wobbleRect(KNOB - 4, KNOB - 4, round((KNOB - 4) / 2), 23, { amp: 1.1, step: 8 });

export function Joystick({
  onVector,
  style,
}: {
  onVector: (v: Vec2) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [knob, setKnob] = useState<Vec2>({ x: 0, y: 0 });
  const [screenReader, setScreenReader] = useState(false);
  const onVectorRef = useRef(onVector);
  onVectorRef.current = onVector;

  // 언마운트 시(회의 전환 등) 스틱을 놓은 것으로 처리 — velRef 잔류 방지
  useEffect(() => () => onVectorRef.current({ x: 0, y: 0 }), []);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled().then((enabled) => active && setScreenReader(enabled));
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  function nudge(vector: Vec2) {
    onVectorRef.current(vector);
    setTimeout(() => onVectorRef.current({ x: 0, y: 0 }), 180);
  }

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_e, g) => {
          onVectorRef.current(stickVector(g.dx, g.dy));
          setKnob(knobOffset(g.dx, g.dy));
        },
        onPanResponderRelease: () => {
          onVectorRef.current({ x: 0, y: 0 });
          setKnob({ x: 0, y: 0 });
        },
        onPanResponderTerminate: () => {
          onVectorRef.current({ x: 0, y: 0 });
          setKnob({ x: 0, y: 0 });
        },
      }),
    [],
  );

  if (screenReader) {
    return (
      <View style={[styles.accessiblePad, style]} accessibilityLabel="방향 이동 버튼">
        <Pressable
          style={[styles.directionButton, styles.up]}
          onPress={() => nudge({ x: 0, y: -1 })}
          accessibilityRole="button"
          accessibilityLabel="위로 이동"
        >
          <Text style={styles.directionText}>↑</Text>
        </Pressable>
        <Pressable
          style={[styles.directionButton, styles.left]}
          onPress={() => nudge({ x: -1, y: 0 })}
          accessibilityRole="button"
          accessibilityLabel="왼쪽으로 이동"
        >
          <Text style={styles.directionText}>←</Text>
        </Pressable>
        <Pressable
          style={[styles.directionButton, styles.right]}
          onPress={() => nudge({ x: 1, y: 0 })}
          accessibilityRole="button"
          accessibilityLabel="오른쪽으로 이동"
        >
          <Text style={styles.directionText}>→</Text>
        </Pressable>
        <Pressable
          style={[styles.directionButton, styles.down]}
          onPress={() => nudge({ x: 0, y: 1 })}
          accessibilityRole="button"
          accessibilityLabel="아래로 이동"
        >
          <Text style={styles.directionText}>↓</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      {...responder.panHandlers}
      style={[styles.base, style]}
      accessibilityLabel="이동 조이스틱"
      accessible={false}
    >
      <Svg
        width={BASE}
        height={BASE}
        style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
      >
        <Path
          d={BASE_PATH}
          x={2}
          y={2}
          fill={colors.paper}
          fillOpacity={0.35}
          stroke={colors.ink}
          strokeWidth={2}
          opacity={0.55}
        />
      </Svg>
      <View
        style={[
          styles.knob,
          { transform: [{ translateX: knob.x }, { translateY: knob.y }], pointerEvents: "none" },
        ]}
      >
        <Svg width={KNOB} height={KNOB}>
          <Path d={KNOB_PATH} x={2} y={2} fill={colors.paper} stroke={colors.ink} strokeWidth={2} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: BASE,
    height: BASE,
    alignItems: "center",
    justifyContent: "center",
  },
  knob: { width: KNOB, height: KNOB },
  accessiblePad: { width: BASE, height: BASE, position: "relative" },
  directionButton: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  up: { top: 0, left: (BASE - 44) / 2 },
  left: { top: (BASE - 44) / 2, left: 0 },
  right: { top: (BASE - 44) / 2, right: 0 },
  down: { bottom: 0, left: (BASE - 44) / 2 },
  directionText: { color: colors.ink, fontSize: 22, fontWeight: "800" },
});
