/**
 * Timing (타이밍 멈춤) — a marker sweeps left↔right. Tap STOP while it's in [0.4,0.6].
 * 3 hits → onComplete. A miss just continues (no penalty, MVP).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, doodle, fonts } from "../../../lib/theme";
import { inTargetZone } from "../../../lib/minigame-logic";
import { DoodleButton } from "../../Doodle";
import { useReducedMotion } from "react-native-reanimated";
import { hapticError, hapticSelect, hapticSuccess } from "../../../lib/haptics";

const TARGET_LO = 0.4;
const TARGET_HI = 0.6;
const SWEEP_MS = 1500; // one full half-sweep (0→1 or 1→0)
const TICK_MS = 16; // ~60fps
const HITS_NEEDED = 3;

export function Timing({ onComplete }: { onComplete: () => void }) {
  const reducedMotion = useReducedMotion();
  const [hits, setHits] = useState(0);
  const [lastResult, setLastResult] = useState<"hit" | "miss" | null>(null);
  const [done, setDone] = useState(false);
  const [staticMode, setStaticMode] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) setStaticMode(true);
  }, [reducedMotion]);

  const posRef = useRef(0); // 0..1, current marker position
  const dirRef = useRef(1); // 1 = moving right, -1 = moving left
  const animX = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false); // synchronous guard against double-onComplete on rapid taps

  const clearSweep = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (done || staticMode) {
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
  }, [done, staticMode, animX]);

  const handleStop = useCallback(() => {
    if (doneRef.current) return;
    const pos = posRef.current;
    if (inTargetZone(pos, TARGET_LO, TARGET_HI)) {
      if (hits + 1 >= HITS_NEEDED) hapticSuccess();
      else hapticSelect();
      setHits((h) => {
        const nextHits = h + 1;
        if (nextHits >= HITS_NEEDED && !doneRef.current) {
          doneRef.current = true; // set synchronously so a same-tick double-tap can't re-fire
          setDone(true);
          onComplete();
        }
        return nextHits;
      });
      setLastResult("hit");
    } else {
      hapticError();
      setLastResult("miss");
    }
    // Clear result flash after 600ms (tracked so it can't fire after unmount)
    if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setLastResult(null), 600);
  }, [hits, onComplete]);

  const handleStaticChoice = useCallback(
    (choice: "left" | "center" | "right") => {
      if (doneRef.current) return;
      if (choice !== "center") {
        hapticError();
        setLastResult("miss");
        return;
      }
      if (hits + 1 >= HITS_NEEDED) hapticSuccess();
      else hapticSelect();
      setHits((value) => {
        const next = value + 1;
        if (next >= HITS_NEEDED && !doneRef.current) {
          doneRef.current = true;
          setDone(true);
          onComplete();
        }
        return next;
      });
      setLastResult("hit");
    },
    [hits, onComplete],
  );

  // Clear the flash timer on unmount (the sweep interval is cleared by its own effect).
  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const resultColor =
    lastResult === "hit" ? colors.success : lastResult === "miss" ? colors.danger : "transparent";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>타이밍 멈춤</Text>
      <Text accessibilityLiveRegion="polite" style={styles.hint}>
        {staticMode ? "가운데 안전 구간을 선택하세요" : "막대가 분홍 구간에 있을 때 멈추세요"} — {hits}/{HITS_NEEDED} 성공
      </Text>

      {staticMode ? (
        <View style={styles.staticChoices} accessibilityRole="radiogroup">
          {(["left", "center", "right"] as const).map((choice) => (
            <Pressable
              key={choice}
              accessibilityRole="button"
              accessibilityLabel={choice === "left" ? "왼쪽 구간" : choice === "center" ? "가운데 안전 구간" : "오른쪽 구간"}
              onPress={() => handleStaticChoice(choice)}
              style={({ pressed }) => [styles.staticChoice, choice === "center" && styles.staticTarget, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.staticChoiceText}>{choice === "left" ? "왼쪽" : choice === "center" ? "가운데" : "오른쪽"}</Text>
            </Pressable>
          ))}
        </View>
      ) : <>
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
              { backgroundColor: i < hits ? colors.success : colors.grayLight },
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
        accessibilityRole="button"
        accessibilityState={{ disabled: done }}
      >
        <Text style={[styles.stopLabel, { color: done ? colors.grayMid : colors.onAccent }]}>
          {done ? "완료 ✓" : "STOP"}
        </Text>
      </Pressable>
      </>}
      <View style={styles.modeAction}>
        <DoodleButton
          title={staticMode ? "움직이는 모드로 전환" : "움직임 없는 선택 모드"}
          onPress={() => setStaticMode((value) => !value)}
          disabled={done}
        />
      </View>
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
    color: colors.grayDark,
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
  staticChoices: { alignSelf: "stretch", flexDirection: "row", gap: 8, marginBottom: 16 },
  staticChoice: {
    flex: 1,
    minHeight: 64,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  staticTarget: { backgroundColor: colors.accentFill, borderColor: colors.accentDeep },
  staticChoiceText: { fontSize: 15, fontWeight: "700", color: colors.ink },
  modeAction: { alignSelf: "stretch", marginTop: 12 },
});
