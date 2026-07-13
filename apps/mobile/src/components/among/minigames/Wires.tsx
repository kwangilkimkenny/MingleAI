/**
 * Wires (선 잇기) — tap a left node then the matching right node to connect them.
 * Match is determined by symbol equality (B&W; no color needed).
 */
import { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { colors, doodle, fonts } from "../../../lib/theme";
import { wiresSolved } from "../../../lib/minigame-logic";

const SYMBOLS = ["★", "●", "▲", "■"] as const;

/** Fisher-Yates shuffle — returns a new array. */
function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function Wires({ onComplete }: { onComplete: () => void }) {
  const [leftSymbols] = useState<string[]>(() => [...SYMBOLS]);
  const [rightSymbols] = useState<string[]>(() => shuffle(SYMBOLS));
  // links: leftIndex → rightIndex
  const [links, setLinks] = useState<Record<number, number>>({});
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);

  const handleLeftTap = useCallback(
    (li: number) => {
      // Already linked — deselect/reselect
      if (links[li] !== undefined) {
        setSelectedLeft(li);
        return;
      }
      setSelectedLeft(li);
    },
    [links],
  );

  const handleRightTap = useCallback(
    (ri: number) => {
      if (selectedLeft === null) return;

      const newLinks = { ...links, [selectedLeft]: ri };
      setLinks(newLinks);
      setSelectedLeft(null);

      if (wiresSolved(leftSymbols, rightSymbols, newLinks)) {
        onComplete();
      }
    },
    [selectedLeft, links, leftSymbols, rightSymbols, onComplete],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>선 잇기</Text>
      <Text style={styles.hint}>같은 기호끼리 연결하세요</Text>
      <View style={styles.columns}>
        {/* Left column */}
        <View style={styles.col}>
          {leftSymbols.map((sym, li) => {
            const linked = links[li] !== undefined;
            const active = selectedLeft === li;
            const bg = active
              ? colors.accent
              : linked
                ? colors.fillDeep
                : colors.paper;
            const textColor = active ? colors.onAccent : colors.ink;
            return (
              <Pressable
                key={li}
                onPress={() => handleLeftTap(li)}
                style={({ pressed }) => [
                  styles.node,
                  { backgroundColor: bg, borderColor: active ? colors.accent : colors.ink },
                  pressed && { opacity: 0.75 },
                ]}
                accessibilityLabel={`왼쪽 ${sym}`}
              >
                <Text style={[styles.nodeSym, { color: textColor }]}>{sym}</Text>
                {linked && (
                  <Text style={styles.checkMark}>✓</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Connection indicators */}
        <View style={styles.mid}>
          {leftSymbols.map((sym, li) => {
            const ri = links[li];
            const matched = ri !== undefined && leftSymbols[li] === rightSymbols[ri];
            return (
              <View key={li} style={styles.lineRow}>
                <View
                  style={[
                    styles.lineSeg,
                    { backgroundColor: matched ? colors.accent : colors.grayLight },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* Right column */}
        <View style={styles.col}>
          {rightSymbols.map((sym, ri) => {
            // Find if this right node is already linked from a left node
            const linkedFromLeft = Object.values(links).includes(ri);
            const bg = linkedFromLeft ? colors.fillDeep : colors.paper;
            return (
              <Pressable
                key={ri}
                onPress={() => handleRightTap(ri)}
                style={({ pressed }) => [
                  styles.node,
                  { backgroundColor: bg, borderColor: colors.ink },
                  pressed && { opacity: 0.75 },
                ]}
                accessibilityLabel={`오른쪽 ${sym}`}
              >
                <Text style={[styles.nodeSym, { color: colors.ink }]}>{sym}</Text>
              </Pressable>
            );
          })}
        </View>
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
    color: colors.grayMid,
    marginBottom: 20,
  },
  columns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  col: {
    gap: 12,
  },
  mid: {
    gap: 12,
    flex: 1,
    alignItems: "center",
  },
  lineRow: {
    height: 52,
    justifyContent: "center",
    width: "100%",
  },
  lineSeg: {
    height: 2,
    width: "80%",
    alignSelf: "center",
  },
  node: {
    width: 56,
    height: 52,
    borderWidth: doodle.border,
    borderColor: colors.ink,
    borderTopLeftRadius: doodle.radius.chip.borderTopLeftRadius,
    borderTopRightRadius: doodle.radius.chip.borderTopRightRadius,
    borderBottomRightRadius: doodle.radius.chip.borderBottomRightRadius,
    borderBottomLeftRadius: doodle.radius.chip.borderBottomLeftRadius,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  nodeSym: {
    fontSize: 22,
    fontWeight: "700",
  },
  checkMark: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: "700",
  },
});
