/**
 * Joystick — 좌하단 고정 가상 스틱. PanResponder(dx/dy는 grant 기준)라서
 * RN Web에서도 동작한다(locationX 불사용). grant 지점을 스틱 중심으로 취급하는
 * "고정 베이스 + 마이크로 플로팅" 방식 — 베이스 어디를 눌러도 그 지점이 기준.
 * 이동은 onVector로만 나간다(부모 velRef → rAF 적분). 노브 상태는 로컬 렌더 전용.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
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
  const onVectorRef = useRef(onVector);
  onVectorRef.current = onVector;

  // 언마운트 시(회의 전환 등) 스틱을 놓은 것으로 처리 — velRef 잔류 방지
  useEffect(() => () => onVectorRef.current({ x: 0, y: 0 }), []);

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

  return (
    <View
      {...responder.panHandlers}
      style={[styles.base, style]}
      accessibilityLabel="이동 조이스틱"
    >
      <Svg width={BASE} height={BASE} style={StyleSheet.absoluteFill} pointerEvents="none">
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
        pointerEvents="none"
        style={[styles.knob, { transform: [{ translateX: knob.x }, { translateY: knob.y }] }]}
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
});
