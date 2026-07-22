/**
 * Sequence (순서 누르기) — tap numbers 1..6 in ascending order.
 * A wrong tap resets to expecting 1. Tapping 6 in order → onComplete.
 */
import { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { colors, doodle, fonts } from "../../../lib/theme";
import { sequenceStep } from "../../../lib/minigame-logic";
import { hapticError, hapticSelect, hapticSuccess } from "../../../lib/haptics";

const MAX = 6;

/** Lay numbers in a scrambled-looking 2-column grid. */
const POSITIONS = [1, 2, 3, 4, 5, 6] as const;

/** Deterministic scramble (not random) so the grid looks shuffled but is stable. */
const GRID_ORDER: number[] = [3, 1, 5, 2, 6, 4]; // visual grid order, left→right, top→bottom

export function Sequence({ onComplete }: { onComplete: () => void }) {
  const [expected, setExpected] = useState(1);
  // Set of numbers already tapped correctly
  const [done, setDone] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState("1부터 차례대로 시작하세요.");

  const handleTap = useCallback(
    (num: number) => {
      const result = sequenceStep(expected, num, MAX);
      if (result.done) {
        const nextDone = new Set(done).add(num);
        setDone(nextDone);
        setExpected(result.expected);
        setFeedback("미션을 완료했어요.");
        hapticSuccess();
        onComplete();
      } else if (result.expected !== expected) {
        // Correct tap, advance
        setDone((prev) => new Set(prev).add(num));
        setExpected(result.expected);
        setFeedback(`${num} 정답. 다음은 ${result.expected}이에요.`);
        hapticSelect();
      } else {
        // Wrong tap — reset
        setDone(new Set());
        setExpected(1);
        setFeedback("순서가 달라 처음부터 다시 시작해요.");
        hapticError();
      }
    },
    [expected, done, onComplete],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>순서 누르기</Text>
      <Text accessibilityLiveRegion="polite" style={styles.hint}>
        1부터 {MAX}까지 순서대로 누르세요 — 다음:{" "}
        <Text style={styles.expectedNum}>{expected}</Text>
      </Text>
      <Text accessibilityLiveRegion="assertive" style={styles.feedback}>{feedback}</Text>
      <View style={styles.grid}>
        {GRID_ORDER.map((num) => {
          const isDone = done.has(num);
          const isNext = num === expected;
          const bg = isDone ? colors.accent : colors.paper;
          const textColor = isDone ? colors.onAccent : isNext ? colors.accent : colors.ink;
          const borderColor = isNext && !isDone ? colors.accent : colors.ink;
          return (
            <Pressable
              key={num}
              onPress={() => !isDone && handleTap(num)}
              disabled={isDone}
              style={({ pressed }) => [
                styles.cell,
                { backgroundColor: bg, borderColor },
                pressed && !isDone && { opacity: 0.75 },
              ]}
              accessibilityLabel={`숫자 ${num}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isDone, selected: isNext && !isDone }}
              accessibilityHint={isDone ? "완료됨" : isNext ? "다음에 누를 숫자" : `현재는 ${expected}을 누를 차례예요`}
            >
              <Text style={[styles.cellNum, { color: textColor }]}>
                {isDone ? "✓" : num}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* Progress strip */}
      <View style={styles.progress}>
        {POSITIONS.map((n) => (
          <View
            key={n}
            style={[
              styles.pip,
              { backgroundColor: done.has(n) ? colors.success : colors.grayLight },
            ]}
          />
        ))}
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
    marginBottom: 4,
    textAlign: "center",
  },
  expectedNum: {
    color: colors.accent,
    fontWeight: "700",
  },
  feedback: { fontSize: 13, lineHeight: 19, color: colors.grayDark, marginBottom: 12, textAlign: "center" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    marginBottom: 20,
    maxWidth: 240,
  },
  cell: {
    width: 68,
    height: 68,
    borderWidth: doodle.border,
    borderTopLeftRadius: doodle.radius.card.borderTopLeftRadius,
    borderTopRightRadius: doodle.radius.card.borderTopRightRadius,
    borderBottomRightRadius: doodle.radius.card.borderBottomRightRadius,
    borderBottomLeftRadius: doodle.radius.card.borderBottomLeftRadius,
    alignItems: "center",
    justifyContent: "center",
  },
  cellNum: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "700",
  },
  progress: {
    flexDirection: "row",
    gap: 8,
  },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
