/**
 * SuggestedQuestion — 라운드(화상/음성 대화) 화면 하단 1/3 지점에 뜨는 추천 질문.
 * 30개 풀에서 세션마다 랜덤 순서로 순환하며, 스르륵(fade) 나타났다가 스르륵 다음 질문으로
 * 교체된다(crossfade). 대화가 끊겼을 때 집어들 소재를 주는 장치 — 라벨·프레임 없이 텍스트만.
 */
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { dark, fonts } from "../../lib/theme";

const QUESTIONS = [
  "요즘 가장 자주 웃게 되는 순간은 언제예요?",
  "주말 아침엔 보통 뭘 하면서 시작해요?",
  "최근에 본 것 중 제일 좋았던 영화나 드라마는요?",
  "스트레스 받으면 어떻게 풀어요?",
  "여행 간다면 산과 바다 중 어디로 가고 싶어요?",
  "요즘 빠져 있는 음식이 있나요?",
  "하루 중 제일 좋아하는 시간대는 언제예요?",
  "어릴 때 꿈은 뭐였어요?",
  "지금 일은 어떻게 시작하게 됐어요?",
  "쉬는 날 집콕과 밖순이 중 어느 쪽이에요?",
  "최근에 새로 시작한 게 있다면요?",
  "인생 음식 하나만 꼽는다면요?",
  "노래방 가면 꼭 부르는 노래 있어요?",
  "요즘 플레이리스트에서 제일 많이 듣는 곡은요?",
  "반려동물 키워본 적 있어요?",
  "계절 중에 언제를 제일 좋아해요?",
  "커피파예요, 차파예요?",
  "요즘 제일 기대되는 일이 뭐예요?",
  "친구들은 본인을 어떤 사람이라고 해요?",
  "몰입해서 밤새 해본 일이 있나요?",
  "운동은 뭐 좋아해요?",
  "제일 기억에 남는 여행지는 어디였어요?",
  "매운 음식 잘 먹는 편이에요?",
  "아침형 인간이에요, 저녁형 인간이에요?",
  "요즘 배워보고 싶은 게 있다면요?",
  "휴가가 일주일 생기면 뭘 하고 싶어요?",
  "본인만의 소소한 행복 루틴이 있나요?",
  "첫인상과 실제 성격이 다르다는 말 들어봤어요?",
  "즉흥 계획과 철저한 계획 중 어느 쪽이에요?",
  "올해 꼭 이루고 싶은 목표가 있어요?",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SHOW_MS = 9000; // 한 질문이 머무는 시간
const FADE_MS = 800; // 스르륵 등장/퇴장 시간

export function SuggestedQuestion() {
  const reducedMotion = useReducedMotion();
  const [order] = useState(() => shuffle(QUESTIONS));
  const [idx, setIdx] = useState(0);
  const opacity = useSharedValue(0);
  const alive = useRef(true);

  function advance() {
    if (!alive.current) return;
    setIdx((i) => (i + 1) % order.length);
    opacity.value = withTiming(1, { duration: FADE_MS });
  }

  useEffect(() => {
    alive.current = true;
    if (reducedMotion) {
      opacity.value = 1;
      const t = setInterval(() => setIdx((i) => (i + 1) % order.length), SHOW_MS);
      return () => {
        alive.current = false;
        clearInterval(t);
      };
    }
    opacity.value = withTiming(1, { duration: FADE_MS });
    const t = setInterval(() => {
      opacity.value = withTiming(0, { duration: FADE_MS }, (finished) => {
        if (finished) runOnJS(advance)();
      });
    }, SHOW_MS);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={style}>
        <Text style={styles.text}>{order[idx]}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 라운드 화면 하단 1/3 지점(bottom 33%)에 겹쳐 배치 — 하단 파트너 라벨과 안 겹친다.
  wrap: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: "33%",
    alignItems: "center",
  },
  text: {
    fontFamily: fonts.bodySemibold,
    fontSize: 17,
    lineHeight: 26,
    color: dark.text,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
});
