import { colors, doodle, layout, space, type } from "../../../src/lib/theme";
import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Heart, ShieldCheck, Sparkles, Users, Video, X } from "lucide-react-native";
import { getMyProfile } from "@mingle/client-core";
import { DoodleButton, DoodleCard, ShadowBox } from "../../../src/components/Doodle";
import { Enter } from "../../../src/components/Motion";
import { useTabBarClearance } from "../../../src/components/DoodleTabBar";
import { ContentColumn, IconButton } from "../../../src/components/Foundation";

export default function Home() {
  const clearance = useTabBarClearance();
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [showNotice, setShowNotice] = useState(true);
  const [name, setName] = useState<string | null>(null);
  const navigatingRef = useRef(false);

  // Reset the nav guard AND refetch the profile whenever home regains focus, so the
  // greeting name is fresh after e.g. returning from settings.
  useFocusEffect(
    useCallback(() => {
      navigatingRef.current = false;
      let alive = true;
      getMyProfile()
        .then((profile) => {
          if (alive && profile) setName(profile.name);
        })
        .catch(() => {
          // Ignore — the greeting simply falls back to the nameless form.
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  function onStartMatching() {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    router.push("/(app)/matching");
  }

  function onStartSpeedDate() {
    router.push("/(app)/speed-date");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
    >
      <ContentColumn style={styles.column}>
      {notice && showNotice ? (
        <DoodleCard
          tone="fill"
          rotate="-1deg"
          style={styles.noticeCard}
          contentStyle={styles.noticeInner}
        >
          <Text style={styles.noticeText}>{notice}</Text>
          <IconButton
            label="안내 닫기"
            onPress={() => setShowNotice(false)}
            icon={<X color={colors.ink} size={18} />}
          />
        </DoodleCard>
      ) : null}

      <Enter index={0}>
        <View style={styles.appbar}>
          <Text style={styles.greetingTiny}>안녕하세요</Text>
          <Text style={styles.greetingTitle}>
            {name ? `${name}님, 오늘 나가볼까요?` : "오늘 나가볼까요?"}
          </Text>
        </View>
      </Enter>

      <Enter index={1}>
        <ShadowBox
          radius={doodle.radius.card}
          bg={colors.ink}
          rotate="-0.6deg"
          style={styles.heroOuter}
        >
          <View style={styles.heroInner}>
            <View style={styles.heroTitleRow}>
              <Sparkles color={colors.accentSoft} size={22} strokeWidth={2.4} />
              <Text style={styles.heroTitle}>오늘의 게임 파티</Text>
            </View>
            <Text style={styles.heroDesc}>
              취향과 대화 스타일을 바탕으로 함께 놀기 편한 사람들을 찾아요. 매칭은 가능성을
              제안하고, 다음 선택은 언제나 직접 결정해요.
            </Text>
            <DoodleButton
              title="매칭 시작"
              onPress={onStartMatching}
              variant="primary"
              rotate="-0.8deg"
              icon={(color, size) => <Heart color={color} size={size} strokeWidth={2} />}
            />
          </View>
        </ShadowBox>
      </Enter>

      <Enter index={2}>
        <DoodleCard contentStyle={styles.blindCard}>
          <View style={styles.blindHeadRow}>
            <Video color={colors.accent} size={22} strokeWidth={2.2} />
            <Text style={styles.blindTitle}>블라인드 데이트</Text>
          </View>
          <Text style={styles.blindDesc}>
            남 3 · 여 3이 3분씩 1:1 화상 대화. 변조 목소리·캐릭터로 시작해 목소리, 얼굴 순으로
            공개돼요. 첫인상보다 대화의 결을 먼저 느껴보세요.
          </Text>
          <DoodleButton
            title="블라인드 데이트 시작"
            onPress={onStartSpeedDate}
            variant="secondary"
            icon={(color, size) => <Video color={color} size={size} strokeWidth={2} />}
          />
        </DoodleCard>
      </Enter>

      <Enter index={3}>
        <DoodleCard tone="fill" contentStyle={styles.journeyCard}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>만남은 이렇게 이어져요</Text>
          <View style={styles.stepRow}>
            <View style={styles.stepIcon}><Users color={colors.ink} size={19} /></View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>게임에서 먼저 만나기</Text>
              <Text style={styles.stepBody}>가벼운 활동과 대화로 서로의 분위기를 알아봐요.</Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepIcon}><Heart color={colors.accent} size={19} /></View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>서로 선택하기</Text>
              <Text style={styles.stepBody}>프로포즈가 서로 수락된 뒤에만 1:1 대화가 열려요.</Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepIcon}><ShieldCheck color={colors.success} size={20} /></View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>내 속도와 안전 지키기</Text>
              <Text style={styles.stepBody}>언제든 멤버 정보, 신고, 차단 기능을 사용할 수 있어요.</Text>
            </View>
          </View>
        </DoodleCard>
      </Enter>

      <Enter index={4}>
        <Text style={styles.hint}>
          채팅·프로포즈·알림은 아래 탭에서 언제든 확인할 수 있어요.
        </Text>
      </Enter>
      </ContentColumn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: layout.screenGutter },
  column: { gap: space.x5, paddingTop: space.x5 },
  noticeCard: { marginBottom: 4 },
  noticeInner: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  noticeText: { ...type.caption, flex: 1, color: colors.grayDark },
  appbar: { gap: 2 },
  greetingTiny: { ...type.caption, color: colors.grayDark },
  greetingTitle: { ...type.title, color: colors.ink },
  heroOuter: { alignSelf: "stretch" },
  heroInner: { padding: space.x5, gap: space.x3 },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroTitle: { ...type.heading, color: colors.paper },
  heroDesc: { ...type.body, color: colors.paper },
  journeyCard: { gap: space.x4 },
  blindCard: { gap: space.x3 },
  blindHeadRow: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  blindTitle: { ...type.heading, color: colors.ink },
  blindDesc: { ...type.body, color: colors.grayDark },
  sectionTitle: { ...type.heading, color: colors.ink },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: space.x3 },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { flex: 1, gap: space.x1 },
  stepTitle: { ...type.label, color: colors.ink },
  stepBody: { ...type.caption, color: colors.grayDark },
  hint: { ...type.caption, color: colors.grayDark, textAlign: "center", paddingBottom: space.x4 },
});
