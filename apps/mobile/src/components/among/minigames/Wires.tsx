/**
 * Wires (선 잇기) — tap a left node then the matching right node to connect them.
 * Match is determined by symbol equality (B&W; no color needed).
 */
import { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { colors, control, doodle, fonts, type } from "../../../lib/theme";
import { wiresSolved } from "../../../lib/minigame-logic";
import { hapticError, hapticSelect, hapticSuccess } from "../../../lib/haptics";

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
  const linkedCount = Object.keys(links).length;
  const wrongCount = Object.entries(links).filter(
    ([left, right]) => leftSymbols[Number(left)] !== rightSymbols[right],
  ).length;

  const handleLeftTap = useCallback(
    (li: number) => {
      // Already linked — deselect/reselect
      if (links[li] !== undefined) {
        hapticSelect();
        setSelectedLeft(li);
        return;
      }
      hapticSelect();
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
        hapticSuccess();
        onComplete();
      } else if (leftSymbols[selectedLeft] !== rightSymbols[ri]) {
        hapticError();
      } else {
        hapticSelect();
      }
    },
    [selectedLeft, links, leftSymbols, rightSymbols, onComplete],
  );

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <Text style={styles.title}>선 잇기</Text>
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {selectedLeft === null
            ? "왼쪽 기호부터 선택하세요"
            : `${leftSymbols[selectedLeft]}와 같은 오른쪽 기호를 선택하세요`}
        </Text>
        <Text accessibilityLiveRegion="assertive" style={styles.statusText}>
          {wrongCount > 0 ? `${wrongCount}개 다시` : `${linkedCount}/${SYMBOLS.length}`}
        </Text>
      </View>
      <View style={styles.columns}>
        {/* Left column */}
        <View style={styles.col}>
          {leftSymbols.map((sym, li) => {
            const linked = links[li] !== undefined;
            const matched = linked && leftSymbols[li] === rightSymbols[links[li]];
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
                accessibilityRole="button"
                accessibilityState={{ selected: active, checked: linked }}
                accessibilityHint={linked ? "연결됨. 다시 선택해 연결을 바꿀 수 있어요" : "선택한 뒤 같은 오른쪽 기호를 누르세요"}
              >
                <Text style={[styles.nodeSym, { color: textColor }]}>{sym}</Text>
                {linked && (
                  <Text style={[styles.checkMark, { color: matched ? colors.success : colors.danger }]}>
                    {matched ? "✓" : "!"}
                  </Text>
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
                    { backgroundColor: matched ? colors.success : colors.grayLight },
                  ]}
                />
                <Text style={[styles.matchLabel, matched ? styles.matchGood : styles.matchBad]}>
                  {ri === undefined ? "" : matched ? "✓" : "다시"}
                </Text>
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
                disabled={selectedLeft === null || linkedFromLeft}
                style={({ pressed }) => [
                  styles.node,
                  { backgroundColor: bg, borderColor: colors.ink },
                  pressed && { opacity: 0.75 },
                ]}
                accessibilityLabel={`오른쪽 ${sym}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: selectedLeft === null || linkedFromLeft, checked: linkedFromLeft }}
                accessibilityHint={linkedFromLeft ? "이미 연결됨" : selectedLeft === null ? "먼저 왼쪽 기호를 선택하세요" : "이 기호와 연결"}
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
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
  },
  headingRow: {
    alignSelf: "stretch",
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 4,
  },
  hint: {
    ...type.caption,
    color: colors.grayDark,
    flexShrink: 1,
  },
  columns: {
    width: "100%",
    maxWidth: 280,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  col: {
    gap: 4,
  },
  mid: {
    gap: 4,
    flex: 1,
    alignItems: "center",
  },
  lineRow: {
    height: control.minTouch,
    justifyContent: "center",
    width: "100%",
    alignItems: "center",
  },
  lineSeg: {
    height: 2,
    width: "80%",
    alignSelf: "center",
  },
  matchLabel: { position: "absolute", fontSize: 12, fontWeight: "700", backgroundColor: colors.paper, paddingHorizontal: 3 },
  matchGood: { color: colors.success },
  matchBad: { color: colors.danger },
  statusText: {
    ...type.caption,
    minWidth: 30,
    color: colors.grayDark,
    textAlign: "right",
    fontFamily: fonts.bodySemibold,
  },
  node: {
    width: 56,
    height: control.minTouch,
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
    fontWeight: "700",
  },
});
