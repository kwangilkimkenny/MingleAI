import { useCallback, useState } from "react";
import { View, Text, Linking, Pressable, StyleSheet } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
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
import { ChevronRight, MapPin, Navigation } from "lucide-react-native";
import { AppMap, type MapPlace } from "../../../src/components/AppMap";
import { loadPlaceArea, type PlaceArea } from "../../../src/lib/place-area";
import { dark, doodle, space, type } from "../../../src/lib/theme";
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

/** 코스 스텝 종류를 한국어로 — 서버는 매칭 로직용 영문 키(cafe/walk/…)를 준다. */
const STEP_TYPE_LABEL: Record<string, string> = {
  cafe: "카페",
  restaurant: "식사",
  walk: "산책",
  museum: "전시",
  movie: "영화",
  concert: "공연",
  activity: "액티비티",
  bar: "바",
};

function stepTypeLabel(type: string): string {
  return STEP_TYPE_LABEL[type] ?? type;
}

/** 날짜 예시는 늘 가까운 미래로 — 고정 문자열은 시간이 지나면 과거 날짜를 예시로 보여준다. */
function datePlaceholder(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export default function DatePlanScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const myProfileId = useAuthStore((s) => s.profileId);
  const [plan, setPlan] = useState<DatePlanView | null>(null);
  const [phase, setPhase] = useState<"loading" | "form" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  // create-form fields
  const [budget, setBudget] = useState("100000");
  // 만날 지역 = 지도에서 고른 동네(좌표 포함). 좌표가 있어야 서버가 실제 가게를 붙인다.
  const [area, setArea] = useState<PlaceArea | null>(null);
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
        // 살아 있는 플랜 중 가장 최근 것 — 취소된 건 건너뛴다.
        const active =
          [...list]
            .filter((p) => p.status !== "cancelled")
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
        setPlan(active);
        setPhase(active ? "ready" : "form");
      })
      .catch(() => alive && setPhase("error"));
    return () => {
      alive = false;
    };
  }, [matchId]);

  useFocusEffect(load);

  // 지역 선택 화면에서 돌아오면 고른 동네를 반영한다(scope="date" — 맛집 탭 동네와 별개).
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadPlaceArea("date").then((a) => {
        if (alive && a) setArea(a);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  async function onCreate() {
    const amount = Number(budget);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("예산을 1원 이상 숫자로 입력해 주세요.");
      return;
    }
    if (!area) {
      setError("만날 동네를 골라 주세요.");
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
        location: { city: area.label, lat: area.lat, lng: area.lng },
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
      const next = await fn();
      // 취소하면 볼 게 없다 — 빈 "취소됨" 화면에 갇히지 않게 바로 새로 만들기 폼으로 돌린다.
      if (next.status === "cancelled") {
        setPlan(null);
        setPhase("form");
      } else {
        setPlan(next);
      }
    } catch {
      setError("요청을 처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading")
    return (
      <AppScreen tone="dark" header={{ back: true, title: "데이트 플랜" }} body="plain">
        <StateView title="데이트 플랜을 불러오고 있어요" loading dark />
      </AppScreen>
    );
  if (phase === "error")
    return (
      <AppScreen tone="dark" header={{ back: true, title: "데이트 플랜" }} body="plain">
        <StateView title="데이트 플랜을 불러오지 못했어요" actionLabel="다시 시도" onAction={load} dark />
      </AppScreen>
    );

  if (phase === "form") {
    return (
      <AppScreen
        tone="dark"
        keyboardAware
        header={{ back: true, title: "데이트 플랜 만들기" }}
        body="scroll"
        footer={
          <DoodleButton
            title={busy ? "추천 중…" : "데이트 코스 추천받기"}
            disabled={busy}
            onPress={onCreate}
            variant="primary"
            tone="dark"
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
            dark
          />
          <View style={s.field}>
            <Text style={s.fieldLabel}>만날 지역</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={area ? `만날 지역 ${area.label}, 바꾸기` : "만날 지역 고르기"}
              onPress={() => router.push({ pathname: "/(app)/place-area", params: { scope: "date" } })}
              style={({ pressed }) => [s.areaRow, pressed && s.pressed]}
            >
              <MapPin color={dark.accent} size={18} strokeWidth={2} />
              <Text style={s.areaLabel} numberOfLines={1}>
                {area ? area.label : "지도에서 동네 고르기"}
              </Text>
              <ChevronRight color={dark.textMuted} size={18} strokeWidth={1.75} />
            </Pressable>
            {area ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="지도에서 지역 바꾸기"
                onPress={() => router.push({ pathname: "/(app)/place-area", params: { scope: "date" } })}
                style={s.areaMap}
              >
                <AppMap center={{ lat: area.lat, lng: area.lng }} radiusKm={null} places={[]} />
              </Pressable>
            ) : null}
            <Text style={s.fieldHint}>고른 동네의 실제 가게로 코스를 짜드려요.</Text>
          </View>
          <LabeledInput
            label="희망 날짜"
            value={date}
            onChangeText={setDate}
            placeholder={datePlaceholder()}
            hint="비워두면 오늘을 기준으로 코스를 추천해요."
            dark
          />
          {error ? (
            <InlineNotice tone="error" dark>
              {error}
            </InlineNotice>
          ) : null}
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
        title={busy ? "확정 중…" : "이 계획 확정하기"}
        variant="primary"
        tone="dark"
        disabled={busy}
        onPress={() => run(() => confirmDatePlan(p.id))}
      />
    ) : p.status === "confirmed" ? (
      <DoodleButton
        title="만남 완료로 표시"
        variant="primary"
        tone="dark"
        disabled={busy}
        onPress={() => setCompleteOpen(true)}
      />
    ) : undefined;

  return (
    <AppScreen tone="dark" header={{ back: true, title: "데이트 플랜" }} body="scroll" footer={footer}>
      <View style={s.stack}>
        <View style={s.statusRow}>
          <View style={[s.statusPill, statusTone(p.status)]}>
            <Text style={[s.statusText, statusTextTone(p.status)]}>{statusLabel(p.status)}</Text>
          </View>
        </View>

        {error ? (
          <InlineNotice tone="error" dark>
            {error}
          </InlineNotice>
        ) : null}

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
                    tone="dark"
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
            <Text style={s.hint}>데이트 플랜이 확정됐어요!</Text>
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
        dark
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
        dark
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

/** 상태를 색으로도 읽히게 — 확정=세이지, 진행 중=골드, 끝난 것은 조용히 뮤트. */
function statusTone(status: string) {
  if (status === "confirmed") return { backgroundColor: dark.successFill, borderColor: dark.success };
  if (status === "draft") return { backgroundColor: dark.goldFill, borderColor: dark.gold };
  return { backgroundColor: "transparent", borderColor: dark.border };
}

function statusTextTone(status: string) {
  if (status === "confirmed") return { color: dark.success };
  if (status === "draft") return { color: dark.gold };
  return { color: dark.textMuted };
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

/**
 * 코스 카드 — 서버가 실제 가게(place)를 붙여 줬으면 지도에 동선을 찍고, 각 칸에서 바로
 * 네이버 장소 페이지(예약·전화·길찾기)로 갈 수 있게 한다. 없으면 유형 예시로 표시된다.
 */
function CourseCard({ course, action }: { course: DateCourse; action?: React.ReactNode }) {
  const pins: MapPlace[] = course.stops
    .map((st) => (st.place ? { lat: st.place.lat, lng: st.place.lng, title: st.place.name } : null))
    .filter((p): p is MapPlace => p !== null);
  const center = pins.length
    ? {
        lat: pins.reduce((sum, p) => sum + p.lat, 0) / pins.length,
        lng: pins.reduce((sum, p) => sum + p.lng, 0) / pins.length,
      }
    : null;

  return (
    <DoodleCard tone="dark" style={s.card} contentStyle={s.cardInner}>
      <Text style={s.cardTitle}>{course.label}</Text>
      <Text style={s.cardMeta}>
        약 {course.totalEstimatedCost.toLocaleString()}원 · {course.totalEstimatedMinutes}분
        {pins.length ? ` · 실제 장소 ${pins.length}곳` : ""}
      </Text>
      {/* 비용·시간은 가게별 실제 가격이 아니라 유형 평균으로 잡은 값이다. 그대로 두면
          붙어 있는 실제 가게의 가격표처럼 읽힌다 — 근거를 문장으로 밝힌다. */}
      <Text style={s.cardDisclaimer}>
        비용·시간은 유형 평균으로 계산한 예상치예요. 실제 가격은 가게마다 달라요.
      </Text>

      {center ? (
        <View style={s.courseMap}>
          <AppMap center={center} radiusKm={null} fitKm={1.2} places={pins} />
        </View>
      ) : null}

      {course.stops.map((st) => (
        <View key={st.order} style={s.stop}>
          <View style={s.stopHead}>
            <Text style={s.stopName}>
              {st.order}. {st.name}
            </Text>
            {/* 좌표가 없어 실제 가게를 못 붙인 칸 — 이름이 실재 가게로 읽히지 않게 표시한다. */}
            {st.place ? null : (
              <View style={s.exampleTag}>
                <Text style={s.exampleTagText}>예시</Text>
              </View>
            )}
          </View>
          <Text style={s.stopMeta}>
            {/* 금액은 이 가게의 실제 가격이 아니라 유형 평균이다 — 실제 장소가 붙은 칸에서는
                가격을 지우고 소요 시간만 남긴다. 아니면 그 가게 가격표처럼 읽힌다. */}
            {stepTypeLabel(st.type)} · 약 {st.estimatedMinutes}분
          </Text>
          {st.place ? (
            <>
              <Text style={s.stopAddr} numberOfLines={1}>
                {st.place.address}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${st.place.name} 지도에서 보기`}
                onPress={() => void Linking.openURL(st.place!.mapUrl)}
                style={({ pressed }) => [s.stopLink, pressed && s.pressed]}
              >
                <Navigation color={dark.text} size={14} strokeWidth={1.75} />
                <Text style={s.stopLinkText}>지도·예약</Text>
              </Pressable>
            </>
          ) : (
            <Text style={s.stopWhy}>{st.rationale}</Text>
          )}
        </View>
      ))}
      {action}
    </DoodleCard>
  );
}

const s = StyleSheet.create({
  stack: { gap: space.x4 },
  statusRow: { flexDirection: "row" },
  statusPill: {
    paddingHorizontal: space.x3,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { ...type.caption },
  hint: { ...type.body, color: dark.text },
  cancel: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: space.x2 },
  cancelText: { ...type.label, color: dark.danger },
  card: { marginTop: space.x1 },
  cardInner: { padding: space.x4, gap: space.x2 },
  cardTitle: { ...type.heading, color: dark.text },
  cardMeta: { ...type.caption, color: dark.textMuted },
  cardDisclaimer: { ...type.caption, color: dark.textMuted, opacity: 0.8, marginBottom: space.x1 },
  field: { gap: space.x2 },
  fieldLabel: { ...type.label, color: dark.text },
  fieldHint: { ...type.caption, color: dark.textMuted },
  areaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    minHeight: 52,
    paddingHorizontal: space.x4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dark.borderStrong,
    backgroundColor: dark.surface,
  },
  areaLabel: { flex: 1, ...type.label, color: dark.text },
  areaMap: {
    height: 150,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: doodle.border,
    borderColor: dark.border,
  },
  courseMap: {
    height: 150,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: dark.border,
    marginBottom: space.x1,
  },
  pressed: { opacity: 0.7 },
  stopAddr: { ...type.caption, color: dark.textMuted },
  stopLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    minHeight: 36,
    paddingHorizontal: space.x3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: dark.borderStrong,
  },
  stopLinkText: { ...type.caption, color: dark.text },
  stop: { marginTop: space.x2, gap: space.x1 },
  stopHead: { flexDirection: "row", alignItems: "center", gap: space.x2 },
  stopName: { ...type.label, color: dark.text, flexShrink: 1 },
  exampleTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: dark.borderStrong,
  },
  exampleTagText: { ...type.caption, fontSize: 10, color: dark.textMuted },
  stopMeta: { ...type.caption, color: dark.textMuted },
  stopWhy: { ...type.caption, color: dark.textMuted },
});
