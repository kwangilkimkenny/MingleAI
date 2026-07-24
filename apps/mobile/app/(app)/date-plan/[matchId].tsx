import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  getDatePlansForMatch,
  createDatePlan,
  selectCourse,
  confirmDatePlan,
  cancelDatePlan,
  completeDatePlan,
} from "@mingle/client-core";
import { useAuthStore } from "../../../src/lib/client";
import { AppScreen } from "../../../src/components/AppScreen";
import { DoodleButton, DoodleCard } from "../../../src/components/Doodle";
import { DoodleChip } from "../../../src/components/DoodleSvg";
import { colors, space, type } from "../../../src/lib/theme";
import {
  ConfirmDialog,
  InlineNotice,
  LabeledInput,
  StateView,
} from "../../../src/components/Foundation";

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
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

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
    const amount = Number(budget);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("예산을 1원 이상 숫자로 입력해 주세요.");
      return;
    }
    if (!city.trim()) {
      setError("만날 지역을 입력해 주세요.");
      return;
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("날짜를 YYYY-MM-DD 형식으로 입력해 주세요.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const created = await createDatePlan({
        matchId,
        budget: { total: amount },
        location: { city: city.trim() },
        dateTime: { preferredDate: date || new Date().toISOString().slice(0, 10) },
      });
      setPlan(created);
      setPhase("ready");
    } catch {
      setError("플랜을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<DatePlanView>) {
    setBusy(true);
    setError(null);
    try {
      setPlan(await fn());
    } catch {
      setError("요청을 처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading") return <StateView title="데이트 플랜을 불러오고 있어요" loading />;
  if (phase === "error")
    return (
      <StateView title="데이트 플랜을 불러오지 못했어요" actionLabel="다시 시도" onAction={load} />
    );

  if (phase === "form") {
    return (
      <AppScreen
        header={{ back: true, title: "데이트 플랜 만들기" }}
        body="scroll"
        footer={
          <DoodleButton
            title={busy ? "추천 중..." : "함께 볼 코스 추천 받기"}
            disabled={busy}
            onPress={onCreate}
            variant="primary"
          />
        }
      >
        <View style={s.stack}>
          <LabeledInput
            label="전체 예산"
            value={budget}
            onChangeText={setBudget}
            keyboardType="number-pad"
            hint="두 사람의 예상 총비용을 원 단위로 입력해 주세요."
          />
          <LabeledInput
            label="만날 지역"
            value={city}
            onChangeText={setCity}
            placeholder="예: 서울 성수동"
          />
          <LabeledInput
            label="희망 날짜"
            value={date}
            onChangeText={setDate}
            placeholder="2026-08-01"
            hint="비워두면 오늘을 기준으로 코스를 추천해요."
          />
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        </View>
      </AppScreen>
    );
  }

  // phase === "ready" — plan exists
  const p = plan!;
  const isCreator = myProfileId != null && p.creatorProfileId === myProfileId;
  const selected = p.courses.find((c) => c.courseId === p.selectedCourseId) ?? null;

  // Single primary action moves to the footer; the creator's course pick stays inline on each
  // candidate card (one select button per course — the agreement logic is per-course).
  const footer =
    p.status === "draft" && p.selectedCourseId && !isCreator ? (
      <DoodleButton
        title={busy ? "확정 중..." : "이 계획 확정하기"}
        variant="primary"
        disabled={busy}
        onPress={() => run(() => confirmDatePlan(p.id))}
      />
    ) : p.status === "confirmed" ? (
      <DoodleButton
        title="만남 완료로 표시"
        variant="primary"
        disabled={busy}
        onPress={() => setCompleteOpen(true)}
      />
    ) : undefined;

  return (
    <AppScreen header={{ back: true, title: "데이트 플랜" }} body="scroll" footer={footer}>
      <View style={s.stack}>
        <View style={s.statusRow}>
          <DoodleChip label={statusLabel(p.status)} on={p.status === "confirmed"} />
        </View>

        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

        {p.status === "draft" && !p.selectedCourseId && isCreator && (
          <>
            <Text style={s.hint}>마음에 드는 코스를 선택하세요.</Text>
            {p.courses.map((c) => (
              <CourseCard
                key={c.courseId}
                course={c}
                action={
                  <DoodleButton
                    title="이 코스로 선택"
                    variant="primary"
                    disabled={busy}
                    onPress={() => run(() => selectCourse(p.id, c.courseId))}
                  />
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
          </>
        )}

        {p.status === "confirmed" && (
          <>
            <Text style={s.hint}>데이트 플랜이 확정되었어요!</Text>
            {selected && <CourseCard course={selected} />}
          </>
        )}

        {p.status === "completed" && (
          <>
            <Text style={s.hint}>
              완료된 만남이에요. 함께한 시간을 존중하며 안전하게 대화를 이어가세요.
            </Text>
            {selected && <CourseCard course={selected} />}
          </>
        )}

        {p.status !== "cancelled" && p.status !== "confirmed" && (
          <Pressable
            style={s.cancel}
            disabled={busy}
            onPress={() => setCancelOpen(true)}
            accessibilityRole="button"
          >
            <Text style={s.cancelText}>플랜 취소</Text>
          </Pressable>
        )}
      </View>

      <ConfirmDialog
        visible={cancelOpen}
        title="이 계획을 취소할까요?"
        body="선택한 코스와 상대의 확인 상태가 모두 종료돼요."
        confirmLabel="계획 취소"
        destructive
        busy={busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false);
          void run(() => cancelDatePlan(p.id));
        }}
      />
      <ConfirmDialog
        visible={completeOpen}
        title="만남을 완료했나요?"
        body="완료로 표시하면 이 계획은 더 이상 변경하거나 취소할 수 없어요."
        confirmLabel="완료로 표시"
        busy={busy}
        onCancel={() => setCompleteOpen(false)}
        onConfirm={() => {
          setCompleteOpen(false);
          void run(() => completeDatePlan(p.id));
        }}
      />
    </AppScreen>
  );
}

function statusLabel(status: string) {
  return status === "draft"
    ? "진행 중"
    : status === "confirmed"
      ? "확정됨"
      : status === "completed"
        ? "완료됨"
        : status === "cancelled"
          ? "취소됨"
          : status;
}

function CourseCard({ course, action }: { course: DateCourse; action?: React.ReactNode }) {
  return (
    <DoodleCard tone="fill" style={s.card} contentStyle={s.cardInner}>
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
    </DoodleCard>
  );
}

const s = StyleSheet.create({
  stack: { gap: space.x4 },
  statusRow: { flexDirection: "row" },
  hint: { ...type.body, color: colors.ink },
  cancel: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: space.x2 },
  cancelText: { ...type.label, color: colors.danger },
  card: { marginTop: space.x1 },
  cardInner: { padding: space.x4, gap: space.x2 },
  cardTitle: { ...type.heading, color: colors.ink },
  cardMeta: { ...type.caption, color: colors.grayDark, marginBottom: space.x1 },
  stop: { marginTop: space.x2, gap: space.x1 },
  stopName: { ...type.label, color: colors.ink },
  stopMeta: { ...type.caption, color: colors.grayDark },
  stopWhy: { ...type.caption, color: colors.grayDark },
});
