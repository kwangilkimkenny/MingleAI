/**
 * Timing (타이밍 멈춤) — a marker sweeps left↔right. Tap STOP while it's in [0.4,0.6].
 * 3 hits → onComplete. A miss just continues (no penalty, MVP).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, doodle, fonts } from "../../../lib/theme";
import { inTargetZone } from "../../../lib/minigame-logic";

const TARGET_LO = 0.4;
const TARGET_HI = 0.6;
const SWEEP_MS = 1500; // one full half-sweep (0→1 or 1→0)
const TICK_MS = 16; // ~60fps
const HITS_NEEDED = 3;

export function Timing({ onComplete }: { onComplete: () => void }) {
  const [hits, setHits] = useState(0);
  const [lastResult, setLastResult] = useState<"hit" | "miss" | null>(null);
  const [done, setDone] = useState(false);

  const posRef = useRef(0); // 0..1, current marker position
  const dirRef = useRef(1); // 1 = moving right, -1 = moving left
  const animX = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearSweep = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (done) {
      clearSweep();
      return;
    }
    const step = TICK_MS / SWEEP_MS;
    intervalRef.current = setInterval(() => {
      let next = posRef.current + dirRef.current * step;
      if (next >= 1) {
        next = 1;
        dirRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        dirRef.current = 1;
      }
      posRef.current = next;
      animX.setValue(next);
    }, TICK_MS);
    return () => clearSweep();
  }, [done, animX]);

  const handleStop = useCallback(() => {
    if (done) return;
    const pos = posRef.current;
    if (inTargetZone(pos, TARGET_LO, TARGET_HI)) {
      const nextHits = hits + 1;
      setHits(nextHits);
      setLastResult("hit");
      if (nextHits >= HITS_NEEDED) {
        setDone(true);
        onComplete();
      }
    } else {
      setLastResult("miss");
    }
    // Clear result flash after 600ms
    setTimeout(() => setLastResult(null), 600);
  }, [done, hits, onComplete]);

  const resultColor =
    lastResult === "hit" ? colors.accent : lastResult === "miss" ? colors.grayMid : "transparent";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>타이밍 멈춤</Text>
      <Text style={styles.hint}>
        막대가 분홍 구간에 있을 때 STOP! — {hits}/{HITS_NEEDED} 히트
      </Text>

      {/* Track */}
      <View style={styles.trackOuter}>
        {/* Target zone highlight */}
        <View
          style={[
            styles.targetZone,
            {
              left: `${TARGET_LO * 100}%`,
              width: `${(TARGET_HI - TARGET_LO) * 100}%`,
            },
          ]}
        />
        {/* Sweeping marker */}
        <Animated.View
          style={[
            styles.marker,
            {
              left: animX.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>

      {/* Result flash */}
      <Text style={[styles.resultFlash, { color: resultColor }]}>
        {lastResult === "hit" ? "✓ 히트!" : lastResult === "miss" ? "놓쳤어요" : " "}
      </Text>

      {/* Hit pips */}
      <View style={styles.pips}>
        {Array.from({ length: HITS_NEEDED }, (_, i) => (
          <View
            key={i}
            style={[
              styles.pip,
              { backgroundColor: i < hits ? colors.accent : colors.grayLight },
            ]}
          />
        ))}
      </View>

      {/* STOP button */}
      <Pressable
        onPress={handleStop}
        disabled={done}
        style={({ pressed }) => [
          styles.stopBtn,
          {
            backgroundColor: done
              ? colors.fillDeep
              : pressed
                ? colors.accentDeep
                : colors.accent,
            borderColor: done ? colors.grayLight : colors.ink,
          },
        ]}
        accessibilityLabel="STOP 버튼"
      >
        <Text style={[styles.stopLabel, { color: done ? colors.grayMid : colors.onAccent }]}>
          {done ? "완료 ✓" : "STOP"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: colors.grayMid,
    marginBottom: 20,
    textAlign: "center",
  },
  trackOuter: {
    alignSelf: "stretch",
    height: 36,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.fill,
    marginBottom: 8,
    position: "relative",
  },
  targetZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: colors.accentFill,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.accent,
  },
  marker: {
    position: "absolute",
    top: 4,
    bottom: 4,
    width: 4,
    marginLeft: -2,
    backgroundColor: colors.ink,
    borderRadius: 2,
  },
  resultFlash: {
    fontFamily: fonts.display,
    fontSize: 16,
    height: 22,
    marginBottom: 8,
  },
  pips: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  pip: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  stopBtn: {
    alignSelf: "stretch",
    height: 64,
    borderWidth: doodle.border,
    borderTopLeftRadius: doodle.radius.button.borderTopLeftRadius,
    borderTopRightRadius: doodle.radius.button.borderTopRightRadius,
    borderBottomRightRadius: doodle.radius.button.borderBottomRightRadius,
    borderBottomLeftRadius: doodle.radius.button.borderBottomLeftRadius,
    alignItems: "center",
    justifyContent: "center",
  },
  stopLabel: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 2,
  },
});
