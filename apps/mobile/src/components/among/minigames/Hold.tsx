/**
 * Hold (길게 눌러 채우기) — press and hold the button; a progress bar fills over ~2000ms.
 * Releasing before full pauses the bar at its current value (MVP). Reaching 1 → onComplete.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, doodle, fonts } from "../../../lib/theme";

const FILL_DURATION_MS = 2000;
const TICK_MS = 50;
const INCREMENT = TICK_MS / FILL_DURATION_MS;

export function Hold({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [pressing, setPressing] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Animated width for the fill bar (avoids re-renders during tick)
  const animWidth = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);

  const clearTick = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTick = useCallback(() => {
    clearTick();
    intervalRef.current = setInterval(() => {
      const next = Math.min(progressRef.current + INCREMENT, 1);
      progressRef.current = next;
      animWidth.setValue(next);
      setProgress(next); // for text display (low-frequency re-render is fine)
      if (next >= 1) {
        clearTick();
        setCompleted(true);
        onComplete();
      }
    }, TICK_MS);
  }, [animWidth, onComplete]);

  const handlePressIn = useCallback(() => {
    if (completed) return;
    setPressing(true);
    startTick();
  }, [completed, startTick]);

  const handlePressOut = useCallback(() => {
    setPressing(false);
    clearTick();
  }, []);

  // Cleanup on unmount
  useEffect(() => () => clearTick(), []);

  const pct = Math.round(progress * 100);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>길게 눌러 충전</Text>
      <Text style={styles.hint}>{completed ? "완충 완료!" : "버튼을 꾹 누르고 있으세요"}</Text>

      {/* Progress track */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: animWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
              backgroundColor: completed
                ? colors.accent
                : pressing
                  ? colors.accent
                  : colors.grayMid,
            },
          ]}
        />
        <Text style={styles.pctLabel}>{pct}%</Text>
      </View>

      {/* Hold button */}
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={completed}
        style={({ pressed }) => [
          styles.holdBtn,
          {
            backgroundColor: completed ? colors.fillDeep : pressed ? colors.accent : colors.paper,
            borderColor: completed ? colors.grayLight : colors.ink,
          },
        ]}
        accessibilityLabel="꾹 눌러 충전 버튼"
        accessibilityHint="누르고 있는 동안 충전됩니다"
      >
        <Text
          style={[
            styles.holdLabel,
            { color: completed ? colors.grayMid : pressing ? colors.onAccent : colors.ink },
          ]}
        >
          {completed ? "완료" : "꾹 눌러 충전"}
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
    marginBottom: 24,
  },
  track: {
    alignSelf: "stretch",
    height: 28,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 4,
    overflow: "hidden",
    marginBottom: 28,
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    // right is NOT set so Animated.View width drives the fill
  },
  pctLabel: {
    position: "absolute",
    alignSelf: "center",
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  holdBtn: {
    alignSelf: "stretch",
    height: 80,
    borderWidth: doodle.border,
    borderTopLeftRadius: doodle.radius.button.borderTopLeftRadius,
    borderTopRightRadius: doodle.radius.button.borderTopRightRadius,
    borderBottomRightRadius: doodle.radius.button.borderBottomRightRadius,
    borderBottomLeftRadius: doodle.radius.button.borderBottomLeftRadius,
    alignItems: "center",
    justifyContent: "center",
  },
  holdLabel: {
    fontFamily: fonts.display,
    fontSize: 22,
  },
});
