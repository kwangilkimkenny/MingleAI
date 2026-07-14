import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  getDatePlansForMatch,
  createDatePlan,
  selectCourse,
  confirmDatePlan,
  cancelDatePlan,
} from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";
import { BackButton } from "../../../src/components/BackButton";
import { doodleInputStyle } from "../../../src/components/Doodle";
import { DoodleChip } from "../../../src/components/DoodleSvg";
import { colors, doodle, fonts } from "../../../src/lib/theme";

// Derive types from function return signatures — avoids importing @mingle/shared directly
// (shared is not a direct dep of the mobile app; types flow through client-core).
type DatePlanView = Awaited<ReturnType<typeof getDatePlansForMatch>>[number];
type DateCourse = DatePlanView["courses"][number];

export default function DatePlanScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const myProfileId = useAuthStore((s) => s.profileId);
  const [plan, setPlan] = useState<DatePlanView | null>(null);
  const [phase, setPhase] = useState<"loading" | "form" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  // create-form fields
  const [budget, setBudget] = useState("100000");
  const [city, setCity] = useState("서울");
  const [date, setDate] = useState("");

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    getDatePlansForMatch(matchId)
      .then((list) => {
        if (!alive) return;
        const active = list.find((p) => p.status !== "cancelled") ?? null;
        setPlan(active);
        setPhase(active ? "ready" : "form");
      })
      .catch(() => alive && setPhase("error"));
    return () => {
      alive = false;
    };
  }, [matchId]);

  useFocusEffect(load);

  async function onCreate() {
    setBusy(true);
    try {
      const created = await createDatePlan({
        matchId,
        budget: { total: Number(budget) || 0 },
        location: { city },
        dateTime: { preferredDate: date || new Date().toISOString().slice(0, 10) },
      });
      setPlan(created);
      setPhase("ready");
    } catch {
      Alert.alert("오류", "플랜 생성에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<DatePlanView>) {
    setBusy(true);
    try {
      setPlan(await fn());
    } catch {
      Alert.alert("오류", "요청을 처리하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading")
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  if (phase === "error")
    return (
      <View style={s.center}>
        <Text style={s.ink}>플랜을 불러오지 못했어요.</Text>
      </View>
    );

  if (phase === "form") {
    return (
      <ScrollView contentContainerStyle={s.container}>
        <BackButton />
        <Text style={s.title}>데이트 플랜 만들기</Text>
        <Text style={s.label}>예산(원)</Text>
        <TextInput
          style={s.input}
          value={budget}
          onChangeText={setBudget}
          keyboardType="number-pad"
        />
        <Text style={s.label}>지역</Text>
        <TextInput style={s.input} value={city} onChangeText={setCity} />
        <Text style={s.label}>날짜 (YYYY-MM-DD)</Text>
        <TextInput
          style={s.input}
          value={date}
          onChangeText={setDate}
          placeholder="2026-08-01"
          placeholderTextColor={colors.grayMid}
        />
        <Pressable style={[s.btn, busy && s.btnDisabled]} disabled={busy} onPress={onCreate}>
          <Text style={s.btnText}>{busy ? "생성 중..." : "코스 추천 받기"}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // phase === "ready" — plan exists
  const p = plan!;
  const isCreator = myProfileId != null && p.creatorProfileId === myProfileId;
  const selected = p.courses.find((c) => c.courseId === p.selectedCourseId) ?? null;

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.title}>데이트 플랜</Text>
      <View style={s.statusRow}>
        <DoodleChip label={statusLabel(p.status)} on={p.status === "confirmed"} />
      </View>

      {p.status === "draft" && !p.selectedCourseId && isCreator && (
        <>
          <Text style={s.hint}>마음에 드는 코스를 선택하세요.</Text>
          {p.courses.map((c) => (
            <CourseCard
              key={c.courseId}
              course={c}
              action={
                <Pressable
                  style={s.btn}
                  disabled={busy}
                  onPress={() => run(() => selectCourse(p.id, c.courseId))}
                >
                  <Text style={s.btnText}>이 코스로 선택</Text>
                </Pressable>
              }
            />
          ))}
        </>
      )}

      {p.status === "draft" && !p.selectedCourseId && !isCreator && (
        <>
          <Text style={s.hint}>상대가 코스를 고르는 중이에요.</Text>
          {p.courses.map((c) => (
            <CourseCard key={c.courseId} course={c} />
          ))}
        </>
      )}

      {p.status === "draft" && p.selectedCourseId && (
        <>
          <Text style={s.hint}>
            {isCreator ? "상대의 확정을 기다리는 중이에요." : "이 코스로 진행할까요?"}
          </Text>
          {selected && <CourseCard course={selected} />}
          {!isCreator && (
            <Pressable
              style={[s.btn, busy && s.btnDisabled]}
              disabled={busy}
              onPress={() => run(() => confirmDatePlan(p.id))}
            >
              <Text style={s.btnText}>확정하기</Text>
            </Pressable>
          )}
        </>
      )}

      {p.status === "confirmed" && (
        <>
          <Text style={s.hint}>데이트 플랜이 확정되었어요!</Text>
          {selected && <CourseCard course={selected} />}
        </>
      )}

      {p.status !== "cancelled" && p.status !== "confirmed" && (
        <Pressable
          style={s.cancel}
          disabled={busy}
          onPress={() =>
            Alert.alert("취소", "정말 취소할까요?", [
              { text: "아니요" },
              { text: "취소하기", onPress: () => run(() => cancelDatePlan(p.id)) },
            ])
          }
        >
          <Text style={s.cancelText}>플랜 취소</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function statusLabel(status: string) {
  return status === "draft"
    ? "진행 중"
    : status === "confirmed"
      ? "확정됨"
      : status === "cancelled"
        ? "취소됨"
        : status;
}

function CourseCard({ course, action }: { course: DateCourse; action?: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{course.label}</Text>
      <Text style={s.cardMeta}>
        {course.totalEstimatedCost.toLocaleString()}원 · {course.totalEstimatedMinutes}분
      </Text>
      {course.stops.map((st) => (
        <View key={st.order} style={s.stop}>
          <Text style={s.stopName}>
            {st.order}. {st.name}
          </Text>
          <Text style={s.stopMeta}>
            {st.type} · {st.estimatedCost.toLocaleString()}원 · {st.estimatedMinutes}분
          </Text>
          <Text style={s.stopWhy}>{st.rationale}</Text>
        </View>
      ))}
      {action}
    </View>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, backgroundColor: colors.paper },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.paper,
  },
  ink: { color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginBottom: 4 },
  statusRow: { flexDirection: "row", marginBottom: 12 },
  hint: { color: colors.ink, marginBottom: 12 },
  label: { color: colors.ink, fontSize: 13, marginTop: 10, marginBottom: 4 },
  input: doodleInputStyle,
  btn: {
    backgroundColor: colors.ink,
    ...doodle.radius.button,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.paper, fontWeight: "700" },
  cancel: { padding: 12, alignItems: "center", marginTop: 16 },
  cancelText: { color: colors.grayMid },
  card: {
    borderWidth: doodle.border,
    borderColor: colors.ink,
    ...doodle.radius.card,
    padding: 12,
    marginTop: 12,
    backgroundColor: colors.fill,
    shadowColor: colors.ink,
    shadowOffset: { width: doodle.shadow.x, height: doodle.shadow.y },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  cardTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  cardMeta: { color: colors.grayMid, marginBottom: 8 },
  stop: { marginTop: 8 },
  stopName: { color: colors.ink, fontWeight: "600" },
  stopMeta: { color: colors.grayMid, fontSize: 12 },
  stopWhy: { color: colors.grayDark, fontSize: 12 },
});
