/**
 * Doodle motion primitives (DESIGN.md §5) — sparing, purposeful entrances only.
 *  - `Enter`: 카드가 "톡" 하고 붙는 스티커 등장(페이드 + 8px 상승 스프링), `index`로 stagger.
 *  - 접근성: `useReducedMotion`이 참이면 애니메이션 없이 즉시 최종 상태로 렌더.
 */
import { useEffect, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const STAGGER_MS = 70;
const RISE_PX = 8;

export function Enter({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  /** Stagger slot — 0부터. 리스트에서는 화면에 처음 보이는 수(~8) 이상이면 딜레이를 캡한다. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    const delay = Math.min(index, 8) * STAGGER_MS;
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withSpring(1, { damping: 16, stiffness: 180, overshootClamping: false }),
    );
    // 딜레이 중 완전 투명이 길게 보이지 않게 오파시티는 타이밍으로 살짝 먼저 온다.
    // (단일 progress로 묶으면 스프링 오버슛이 opacity>1로 새므로 분리하지 않고 clamp 처리)
  }, [index, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value),
    transform: [{ translateY: (1 - progress.value) * RISE_PX }],
  }));

  if (reduced) return <Animated.View style={style}>{children}</Animated.View>;
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** 리스트 renderItem용 래퍼 — FlatList 항목을 순차 등장시킨다. */
export function EnterRow({ children, index }: { children: ReactNode; index: number }) {
  return <Enter index={index}>{children}</Enter>;
}

/** 히어로/타이틀용 — 살짝 느린 단독 등장 (stagger 없음). */
export function EnterHero({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    progress.value = withTiming(1, { duration: 320 });
  }, [progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.97 + 0.03 * progress.value }],
  }));

  if (reduced) return <Animated.View style={style}>{children}</Animated.View>;
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
