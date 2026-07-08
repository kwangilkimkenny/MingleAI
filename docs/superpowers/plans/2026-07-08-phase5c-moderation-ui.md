# Phase 5c: Mobile Moderation UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship app-store-compliant mobile moderation UI — report a user, block/unblock, manage the block list — surfaced on every peer-facing screen (chat, party, proposals), plus a new B&W settings screen.

**Architecture:** One new client-core wrapper (`reportUser`) over the existing `POST /safety/report`; one reusable `PeerModerationMenu` (⋯ → `Alert` action menu, zero new deps) dropped into all peer surfaces; three new B&W Expo-Router screens (`report/[profileId]`, `blocks`, `settings`). Block create/list/remove reuse the existing `createBlock`/`getBlocks`/`removeBlock` client-core wrappers.

**Tech Stack:** `@mingle/client-core` (TS ESM, Vitest), `@mingle/mobile` (Expo Router SDK 56, React Native, Vitest for `src/**` helpers, `tsc` for screens).

## Global Constraints

- **Pure black & white — zero chroma.** Palette: ink `#17150F`, paper `#FFFFFF`, grays `#45413A` / `#8A857C` / `#D9D5CC`, fills `#F1EFE9` / `#E7E4DC` (+ transparent). No hue. (OS `Alert` dialogs are exempt — native chrome, matching the existing 차단 `Alert`.)
- **No new runtime dependencies.** The ⋯ menu uses `Alert.alert`, not an action-sheet library.
- ESM `.js` barrel convention; TS strict; Prettier (double quotes, `trailingComma: all`, `printWidth: 100`, semicolons).
- New Expo Router routes are not yet in the gitignored typegen (`.expo/types/router.d.ts`); navigations to them use a narrow `as any` cast with the comment `// new route — Expo Router typegen updates on next \`expo start\``, mirroring `chat/[roomId].tsx`'s date-plan button. `tsc --noEmit` must be CLEAN.
- `noUnusedLocals` is OFF (only `strict: true`) — unused imports do not fail `tsc`, but remove genuinely dead imports for cleanliness where a step says so.
- The reason enum is fixed by the backend: `harassment, fraud, fake_profile, inappropriate_content, spam, other`.
- Do NOT modify the backend `safety` module, payment columns, or the legacy web UI. Never stage `.env`. Do NOT push.
- ANSI-safe error checks: pipe `tsc`/build output through `sed -E 's/\x1b\[[0-9;]*m//g'` before `grep -E "error TS|Found [0-9]+ error"` (a bare `grep "error TS"` false-passes on ANSI color codes).

---

### Task 1: client-core `reportUser` wrapper

**Files:**
- Create: `packages/client-core/src/api/reports.ts`
- Modify: `packages/client-core/src/index.ts` (barrel)
- Test: `packages/client-core/src/__tests__/reports-api.test.ts`

**Interfaces:**
- Consumes: `apiFetch` from `./client.js` (`apiFetch<T>(path, opts?) : Promise<T>`).
- Produces (barrel-exported from `@mingle/client-core`): `reportUser(input: ReportInput): Promise<void>`; `REPORT_REASONS` (readonly 6-tuple); `type ReportReason`; `interface ReportInput { reportedProfileId: string; reason: ReportReason; details?: string; evidencePartyId?: string }`.

- [ ] **Step 1: Write the failing test** — `packages/client-core/src/__tests__/reports-api.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../api/client.js";
import { reportUser, REPORT_REASONS } from "../index.js";

const fetchMock = vi.spyOn(client, "apiFetch").mockResolvedValue(undefined as never);
beforeEach(() => fetchMock.mockClear());

describe("reports API", () => {
  it("reportUser POSTs the full input", async () => {
    await reportUser({
      reportedProfileId: "p2",
      reason: "harassment",
      details: "욕설",
      evidencePartyId: "party1",
    });
    expect(fetchMock).toHaveBeenCalledWith("/safety/report", {
      method: "POST",
      body: JSON.stringify({
        reportedProfileId: "p2",
        reason: "harassment",
        details: "욕설",
        evidencePartyId: "party1",
      }),
    });
  });

  it("reportUser POSTs with only the required fields", async () => {
    await reportUser({ reportedProfileId: "p2", reason: "spam" });
    expect(fetchMock).toHaveBeenCalledWith("/safety/report", {
      method: "POST",
      body: JSON.stringify({ reportedProfileId: "p2", reason: "spam" }),
    });
  });

  it("REPORT_REASONS lists exactly the six backend reasons in order", () => {
    expect(REPORT_REASONS).toEqual([
      "harassment",
      "fraud",
      "fake_profile",
      "inappropriate_content",
      "spam",
      "other",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mingle/client-core test 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "FAIL|Cannot find|No test"`
Expected: FAIL (cannot resolve `reportUser` / `REPORT_REASONS` from `../index.js`).

- [ ] **Step 3: Create `packages/client-core/src/api/reports.ts`**

```ts
import { apiFetch } from "./client.js";

export const REPORT_REASONS = [
  "harassment",
  "fraud",
  "fake_profile",
  "inappropriate_content",
  "spam",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportInput {
  reportedProfileId: string;
  reason: ReportReason;
  details?: string;
  evidencePartyId?: string;
}

export function reportUser(input: ReportInput): Promise<void> {
  return apiFetch<void>("/safety/report", { method: "POST", body: JSON.stringify(input) });
}
```

- [ ] **Step 4: Add barrel exports to `packages/client-core/src/index.ts`**

Add these two lines next to the existing `blocks` export (`export { createBlock, getBlocks, removeBlock } from "./api/blocks.js";`):

```ts
export { reportUser, REPORT_REASONS } from "./api/reports.js";
export type { ReportReason, ReportInput } from "./api/reports.js";
```

- [ ] **Step 5: Run the test to verify it passes + full suite + build**

Run:
```
pnpm --filter @mingle/client-core test 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Test Files|Tests |FAIL"
pnpm --filter @mingle/shared build >/dev/null 2>&1 && pnpm --filter @mingle/client-core build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN
```
Expected: all tests pass (3 new + the existing suite), build CLEAN.

- [ ] **Step 6: Commit**

```bash
git add packages/client-core/src/api/reports.ts packages/client-core/src/index.ts packages/client-core/src/__tests__/reports-api.test.ts
git commit -m "feat(client-core): reportUser wrapper + REPORT_REASONS"
```

---

### Task 2: mobile reason-label helper

**Files:**
- Create: `apps/mobile/src/lib/moderation.ts`
- Test: `apps/mobile/src/lib/__tests__/moderation.test.ts`

**Interfaces:**
- Consumes: `type ReportReason` from `@mingle/client-core` (type-only import — erased at runtime, so the Vitest run needs no bundler resolution of the package).
- Produces: `REASON_LABELS: Record<ReportReason, string>`; `reasonLabel(reason: ReportReason): string`.

- [ ] **Step 1: Write the failing test** — `apps/mobile/src/lib/__tests__/moderation.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { REASON_LABELS, reasonLabel } from "../moderation";

const EXPECTED_REASONS = [
  "harassment",
  "fraud",
  "fake_profile",
  "inappropriate_content",
  "spam",
  "other",
] as const;

describe("moderation reason labels", () => {
  it("has a non-empty label for every backend reason", () => {
    for (const r of EXPECTED_REASONS) {
      expect(REASON_LABELS[r]).toBeTruthy();
    }
  });

  it("exposes exactly the six backend reasons", () => {
    expect(Object.keys(REASON_LABELS).sort()).toEqual([...EXPECTED_REASONS].sort());
  });

  it("reasonLabel maps a reason to its label", () => {
    expect(reasonLabel("harassment")).toBe("괴롭힘 / 폭언");
    expect(reasonLabel("other")).toBe("기타");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && pnpm exec vitest run src/lib/__tests__/moderation.test.ts 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "FAIL|Cannot find"`
Expected: FAIL (cannot resolve `../moderation`).

- [ ] **Step 3: Create `apps/mobile/src/lib/moderation.ts`**

```ts
import type { ReportReason } from "@mingle/client-core";

export const REASON_LABELS: Record<ReportReason, string> = {
  harassment: "괴롭힘 / 폭언",
  fraud: "사기 / 금전 요구",
  fake_profile: "가짜 프로필 / 사칭",
  inappropriate_content: "부적절한 콘텐츠",
  spam: "스팸 / 광고",
  other: "기타",
};

export function reasonLabel(reason: ReportReason): string {
  return REASON_LABELS[reason];
}
```

- [ ] **Step 4: Run the test to verify it passes + full mobile suite**

Run: `cd apps/mobile && pnpm exec vitest run 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Test Files|Tests |FAIL"`
Expected: all pass (3 new + the existing `route-for-notification` suite).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/moderation.ts apps/mobile/src/lib/__tests__/moderation.test.ts
git commit -m "feat(mobile): reason-label helper for moderation"
```

---

### Task 3: `PeerModerationMenu` reusable component

**Files:**
- Create: `apps/mobile/src/components/PeerModerationMenu.tsx`

**Interfaces:**
- Consumes: `createBlock`, `ApiError` from `@mingle/client-core`; `router` from `expo-router`. Navigates to the `report/[profileId]` route (created in Task 4) via an `as any` cast, so it compiles before that screen exists.
- Produces: `PeerModerationMenu` (named export) with props `{ peer: { profileId: string; name: string }; evidencePartyId?: string; onBlocked?: () => void }`.

**Verification note:** React-Native components have no unit-test harness in this repo (established convention — see the date-plan screen). This task's gate is `tsc --noEmit` CLEAN; behavior is exercised through the screens that consume it (Task 7).

- [ ] **Step 1: Create `apps/mobile/src/components/PeerModerationMenu.tsx`**

```tsx
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { createBlock, ApiError } from "@mingle/client-core";

const INK = "#17150F";
const FILL = "#F1EFE9";

export interface PeerModerationMenuProps {
  peer: { profileId: string; name: string };
  evidencePartyId?: string;
  onBlocked?: () => void;
}

export function PeerModerationMenu({ peer, evidencePartyId, onBlocked }: PeerModerationMenuProps) {
  function openReport() {
    router.push({
      // new route — Expo Router typegen updates on next `expo start`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pathname: "/(app)/report/[profileId]" as any,
      params: evidencePartyId
        ? { profileId: peer.profileId, evidencePartyId }
        : { profileId: peer.profileId },
    });
  }

  function confirmBlock() {
    Alert.alert("차단", `${peer.name}님을 차단하시겠어요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "차단",
        style: "destructive",
        onPress: async () => {
          try {
            await createBlock(peer.profileId);
            onBlocked?.();
          } catch (e) {
            Alert.alert("오류", e instanceof ApiError ? e.message : "차단 실패");
          }
        },
      },
    ]);
  }

  function openMenu() {
    Alert.alert(peer.name, undefined, [
      { text: "신고하기", onPress: openReport },
      { text: "차단하기", style: "destructive", onPress: confirmBlock },
      { text: "취소", style: "cancel" },
    ]);
  }

  return (
    <Pressable
      accessibilityLabel="더보기"
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={openMenu}
    >
      <Text style={styles.glyph}>⋯</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  buttonPressed: { backgroundColor: FILL },
  glyph: { fontSize: 20, fontWeight: "700", color: INK },
});
```

- [ ] **Step 2: Verify tsc CLEAN**

Run:
```
pnpm --filter @mingle/shared build >/dev/null 2>&1 && pnpm --filter @mingle/client-core build >/dev/null 2>&1
cd apps/mobile && pnpm exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN
```
Expected: CLEAN.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/PeerModerationMenu.tsx
git commit -m "feat(mobile): reusable PeerModerationMenu (report/block action menu)"
```

---

### Task 4: `report/[profileId]` screen

**Files:**
- Create: `apps/mobile/app/(app)/report/[profileId].tsx`

**Interfaces:**
- Consumes: `reportUser`, `createBlock`, `REPORT_REASONS`, `ApiError`, `type ReportReason` from `@mingle/client-core`; `REASON_LABELS` from `../../../src/lib/moderation`; `useLocalSearchParams`, `router` from `expo-router`.
- Produces: the Expo Router route `/(app)/report/[profileId]` (accepts params `profileId`, optional `evidencePartyId`).

**Verification note:** screen gate is `tsc --noEmit` CLEAN (no RN render-test harness).

- [ ] **Step 1: Create `apps/mobile/app/(app)/report/[profileId].tsx`**

```tsx
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  reportUser,
  createBlock,
  REPORT_REASONS,
  ApiError,
  type ReportReason,
} from "@mingle/client-core";
import { REASON_LABELS } from "../../../src/lib/moderation";

const INK = "#17150F";
const PAPER = "#FFFFFF";
const GRAY_MED = "#8A857C";
const GRAY_LIGHT = "#D9D5CC";
const MAX_DETAILS = 1000;

export default function ReportScreen() {
  const { profileId, evidencePartyId } = useLocalSearchParams<{
    profileId: string;
    evidencePartyId?: string;
  }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      await reportUser({
        reportedProfileId: profileId,
        reason,
        details: details.trim() || undefined,
        evidencePartyId: evidencePartyId || undefined,
      });
      Alert.alert("신고가 접수되었습니다", "이 사용자를 차단할까요?", [
        { text: "아니요", style: "cancel", onPress: () => router.back() },
        {
          text: "이 사용자도 차단",
          style: "destructive",
          onPress: async () => {
            try {
              await createBlock(profileId);
            } catch {
              // block failure is non-fatal to the already-submitted report
            }
            router.back();
          },
        },
      ]);
    } catch (e) {
      setSubmitting(false);
      Alert.alert("신고 실패", e instanceof ApiError ? e.message : "신고를 접수하지 못했어요");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>신고하기</Text>

      <Text style={styles.section}>신고 사유</Text>
      {REPORT_REASONS.map((r) => {
        const selected = reason === r;
        return (
          <Pressable key={r} style={styles.reasonRow} onPress={() => setReason(r)}>
            <View style={[styles.radio, selected && styles.radioOn]}>
              {selected ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={styles.reasonText}>{REASON_LABELS[r]}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.section}>상세 내용 (선택)</Text>
      <TextInput
        style={styles.input}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={MAX_DETAILS}
        placeholder="자세한 상황을 적어주세요"
        placeholderTextColor={GRAY_MED}
      />
      <Text style={styles.counter}>
        {details.length}/{MAX_DETAILS}
      </Text>

      <Pressable
        style={[styles.submit, (!reason || submitting) && styles.submitDisabled]}
        disabled={!reason || submitting}
        onPress={onSubmit}
      >
        {submitting ? (
          <ActivityIndicator color={PAPER} />
        ) : (
          <Text style={styles.submitText}>신고 제출</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  content: { padding: 20, gap: 10 },
  title: { fontSize: 20, fontWeight: "700", color: INK, marginBottom: 4 },
  section: { fontSize: 13, fontWeight: "700", color: GRAY_MED, marginTop: 10 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: GRAY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: INK },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: INK },
  reasonText: { fontSize: 15, color: INK },
  input: {
    borderWidth: 2,
    borderColor: GRAY_LIGHT,
    borderRadius: 8,
    padding: 12,
    minHeight: 96,
    color: INK,
    textAlignVertical: "top",
  },
  counter: { alignSelf: "flex-end", fontSize: 12, color: GRAY_MED },
  submit: {
    marginTop: 12,
    backgroundColor: INK,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitDisabled: { backgroundColor: GRAY_LIGHT },
  submitText: { color: PAPER, fontWeight: "700", fontSize: 15 },
});
```

- [ ] **Step 2: Verify tsc CLEAN**

Run: `cd apps/mobile && pnpm exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN`
Expected: CLEAN.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/report/[profileId].tsx"
git commit -m "feat(mobile): report screen (reason picker + details + optional block)"
```

---

### Task 5: `blocks` screen (view + unblock)

**Files:**
- Create: `apps/mobile/app/(app)/blocks.tsx`

**Interfaces:**
- Consumes: `getBlocks`, `removeBlock`, `ApiError`, `type PeerProfile` from `@mingle/client-core`; `useFocusEffect` from `expo-router`.
- Produces: the Expo Router route `/(app)/blocks`.

**Verification note:** screen gate is `tsc --noEmit` CLEAN.

- [ ] **Step 1: Create `apps/mobile/app/(app)/blocks.tsx`**

```tsx
import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { getBlocks, removeBlock, ApiError, type PeerProfile } from "@mingle/client-core";

const INK = "#17150F";
const PAPER = "#FFFFFF";
const GRAY_MED = "#8A857C";
const GRAY_DARK = "#45413A";

type LoadState = "loading" | "ready" | "error";

export default function BlocksScreen() {
  const [blocks, setBlocks] = useState<PeerProfile[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(() => {
    let alive = true;
    setState("loading");
    getBlocks()
      .then((rows) => {
        if (alive) {
          setBlocks(rows);
          setState("ready");
        }
      })
      .catch(() => {
        if (alive) setState("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(load);

  function onUnblock(peer: PeerProfile) {
    Alert.alert("차단 해제", `${peer.name}님의 차단을 해제할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "해제",
        onPress: async () => {
          try {
            await removeBlock(peer.profileId);
            setBlocks((prev) => prev.filter((b) => b.profileId !== peer.profileId));
          } catch (e) {
            Alert.alert("오류", e instanceof ApiError ? e.message : "차단 해제 실패");
          }
        },
      },
    ]);
  }

  if (state === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={INK} />
      </View>
    );
  }
  if (state === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>차단 목록을 불러오지 못했어요.</Text>
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }
  if (blocks.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>차단한 사용자가 없어요.</Text>
      </View>
    );
  }
  return (
    <FlatList
      style={styles.container}
      data={blocks}
      keyExtractor={(item) => item.profileId}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.name}>
              {item.name} · {item.age}
            </Text>
            <Text style={styles.meta}>{item.occupation}</Text>
          </View>
          <Pressable style={styles.unblock} onPress={() => onUnblock(item)}>
            <Text style={styles.unblockText}>차단 해제</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
    backgroundColor: PAPER,
  },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 10,
    padding: 12,
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: "700", color: INK },
  meta: { fontSize: 13, color: GRAY_DARK },
  unblock: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  unblockText: { color: INK, fontWeight: "700", fontSize: 13 },
  msg: { fontSize: 15, color: GRAY_MED },
  retry: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryText: { color: INK, fontWeight: "700" },
});
```

- [ ] **Step 2: Verify tsc CLEAN**

Run: `cd apps/mobile && pnpm exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN`
Expected: CLEAN.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/blocks.tsx"
git commit -m "feat(mobile): block-list screen (view + unblock)"
```

---

### Task 6: `settings` screen

**Files:**
- Create: `apps/mobile/app/(app)/settings.tsx`

**Interfaces:**
- Consumes: `getMyProfile` from `@mingle/client-core`; `useAuthStore` from `../../src/lib/client` (selector `s => s.logout`, `logout: () => void`); `router`, `useFocusEffect` from `expo-router`. Navigates to `/(app)/blocks` (Task 5) via an `as any` cast (new route).
- Produces: the Expo Router route `/(app)/settings`.

**Verification note:** screen gate is `tsc --noEmit` CLEAN.

- [ ] **Step 1: Create `apps/mobile/app/(app)/settings.tsx`**

```tsx
import { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getMyProfile } from "@mingle/client-core";
import { useAuthStore } from "../../src/lib/client";

const INK = "#17150F";
const PAPER = "#FFFFFF";
const GRAY_MED = "#8A857C";
const GRAY_DARK = "#45413A";
const GRAY_LIGHT = "#D9D5CC";

type MyProfile = NonNullable<Awaited<ReturnType<typeof getMyProfile>>>;

export default function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    getMyProfile()
      .then((p) => {
        if (alive) {
          setProfile(p);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(load);

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        {loading ? (
          <ActivityIndicator color={INK} />
        ) : profile ? (
          <>
            <Text style={styles.name}>
              {profile.name} · {profile.age}
            </Text>
            <Text style={styles.meta}>{profile.occupation}</Text>
          </>
        ) : (
          <Text style={styles.meta}>프로필을 불러오지 못했어요.</Text>
        )}
      </View>

      <Pressable
        style={styles.rowItem}
        onPress={() =>
          // new route — Expo Router typegen updates on next `expo start`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push("/(app)/blocks" as any)
        }
      >
        <Text style={styles.rowText}>차단 목록 관리</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={styles.rowItem} onPress={logout}>
        <Text style={[styles.rowText, styles.danger]}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER, padding: 20, gap: 12 },
  summary: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 12,
    padding: 16,
    gap: 4,
    minHeight: 72,
    justifyContent: "center",
  },
  name: { fontSize: 18, fontWeight: "700", color: INK },
  meta: { fontSize: 14, color: GRAY_DARK },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: GRAY_LIGHT,
    paddingVertical: 16,
  },
  rowText: { fontSize: 16, color: INK },
  danger: { fontWeight: "700" },
  chevron: { fontSize: 20, color: GRAY_MED },
});
```

- [ ] **Step 2: Verify tsc CLEAN**

Run: `cd apps/mobile && pnpm exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN`
Expected: CLEAN.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/settings.tsx"
git commit -m "feat(mobile): settings screen (profile summary + block list + logout)"
```

---

### Task 7: wire moderation entry points (상시 노출)

**Files:**
- Modify: `apps/mobile/app/(app)/chat/[roomId].tsx`
- Modify: `apps/mobile/app/(app)/party/[id].tsx`
- Modify: `apps/mobile/app/(app)/proposals.tsx`
- Modify: `apps/mobile/app/(app)/home.tsx`

**Interfaces:**
- Consumes: `PeerModerationMenu` from `../../../src/components/PeerModerationMenu` (Task 3) — note `home.tsx` and `proposals.tsx` are one level shallower, so their relative import is `../../src/components/PeerModerationMenu`; navigates to `/(app)/settings` (Task 6).

**Verification note:** gate is `tsc --noEmit` CLEAN + the existing mobile Vitest suite unaffected.

- [ ] **Step 1: `chat/[roomId].tsx` — replace the 차단 button with the menu**

1a. Remove `createBlock,` from the `@mingle/client-core` import block (it moves into `PeerModerationMenu`; safe since `noUnusedLocals` is off, but keep it clean).

1b. Add, after the `openMessengerSocket` import line:
```tsx
import { PeerModerationMenu } from "../../../src/components/PeerModerationMenu";
```

1c. Delete the whole `onBlockPress` function (the `function onBlockPress() { … }` block that opens the 차단 `Alert`).

1d. In the header JSX, replace:
```tsx
          <TouchableOpacity onPress={onBlockPress}>
            <Text style={styles.blockText}>차단</Text>
          </TouchableOpacity>
```
with:
```tsx
          {match != null && (
            <PeerModerationMenu
              peer={{ profileId: match.peer.profileId, name: match.peer.name }}
              onBlocked={() => router.replace("/(app)/chats")}
            />
          )}
```

1e. Delete the now-unused `blockText` style key from the `StyleSheet.create({ … })` block.

- [ ] **Step 2: `party/[id].tsx` — add the menu to each non-self participant card**

2a. Add import after the `useAuthStore` import:
```tsx
import { PeerModerationMenu } from "../../../src/components/PeerModerationMenu";
```

2b. Add a hidden-set state inside `PartyScreen`, right after the `proposeSent` state:
```tsx
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
```

2c. In the participants map, skip hidden peers — change `party.participants.map((p) => (` to filter first:
```tsx
      {party.participants
        .filter((p) => !hidden[p.profileId])
        .map((p) => (
```
(keep the existing card body; close the `.map(` parenthesis as before).

2d. Inside the `p.profileId !== myProfileId` block, add the menu at the end of `styles.proposeRow`'s sibling — place it right after the closing `</View>` of `proposeRow`, still inside the `p.profileId !== myProfileId ? ( … ) : null` branch. Wrap the propose row and the menu in a fragment:
```tsx
          {p.profileId !== myProfileId ? (
            <>
              <View style={styles.proposeRow}>
                {/* …existing propose button + error… */}
              </View>
              <View style={styles.menuRow}>
                <PeerModerationMenu
                  peer={{ profileId: p.profileId, name: p.name }}
                  evidencePartyId={id}
                  onBlocked={() => setHidden((prev) => ({ ...prev, [p.profileId]: true }))}
                />
              </View>
            </>
          ) : null}
```

2e. Add a `menuRow` style to the `StyleSheet.create`:
```tsx
  menuRow: { alignItems: "flex-end", marginTop: 4 },
```

- [ ] **Step 3: `proposals.tsx` — add the menu to each proposal card**

3a. Add import after the `@mingle/client-core` import block:
```tsx
import { PeerModerationMenu } from "../../src/components/PeerModerationMenu";
```

3b. In the `renderItem` card, add a header row with the menu above `peerInfo`. Replace:
```tsx
            <View style={styles.card}>
              <View style={styles.peerInfo}>
```
with:
```tsx
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <PeerModerationMenu
                  peer={{ profileId: item.peer.profileId, name: item.peer.name }}
                  onBlocked={() => setProposals((prev) => prev.filter((p) => p.id !== item.id))}
                />
              </View>
              <View style={styles.peerInfo}>
```

3c. Add a `cardHeader` style to `StyleSheet.create`:
```tsx
  cardHeader: { alignItems: "flex-end" },
```

- [ ] **Step 4: `home.tsx` — add 설정 entry, remove the raw 로그아웃 button**

4a. Remove the logout wiring now that settings owns it: delete `const logout = useAuthStore((s) => s.logout);`, the `onLogout` function, and the `import { useAuthStore } from "../../src/lib/client";` line (unused after removal).

4b. Replace the `<Button title="로그아웃" onPress={onLogout} />` line with:
```tsx
      <Button title="설정" onPress={() => router.push("/(app)/settings")} />
```
(`router.push("/(app)/settings")` — if `tsc` flags the new route, apply the same `as any` cast used elsewhere: `router.push("/(app)/settings" as any)` with the `// new route …` comment.)

- [ ] **Step 5: Verify tsc CLEAN + full mobile Vitest unaffected**

Run:
```
pnpm --filter @mingle/shared build >/dev/null 2>&1 && pnpm --filter @mingle/client-core build >/dev/null 2>&1
cd apps/mobile && pnpm exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN
pnpm exec vitest run 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Test Files|Tests |FAIL"
```
Expected: tsc CLEAN; Vitest all pass (Task-2 moderation suite + existing suites).

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/app/(app)/chat/[roomId].tsx" "apps/mobile/app/(app)/party/[id].tsx" "apps/mobile/app/(app)/proposals.tsx" "apps/mobile/app/(app)/home.tsx"
git commit -m "feat(mobile): wire report/block ⋯ into chat, party, proposals + settings entry"
```

---

## Plan Self-Review

**Spec coverage:**
- reportUser wrapper → Task 1. ✅
- Reason labels helper → Task 2. ✅
- PeerModerationMenu (⋯ via Alert, no dep) → Task 3. ✅
- report screen (reason + details + optional block) → Task 4. ✅
- blocks screen (view + unblock) → Task 5. ✅
- settings screen (profile summary + block list + logout) → Task 6. ✅
- 상시 노출 entry points (chat + party + proposals) + home 설정 entry → Task 7. ✅
- Pure B&W palette, no new deps, `as any` for new routes, tsc gate → Global Constraints + every task. ✅
- Out-of-scope items (backend, web, message-level reporting) → not touched. ✅

**Placeholder scan:** No TBD/TODO; every code step carries complete code; every command is concrete with expected output.

**Type consistency:** `reportUser(ReportInput)`, `ReportReason`, `REPORT_REASONS`, `REASON_LABELS`, `PeerProfile`, `PeerModerationMenuProps { peer:{profileId,name}, evidencePartyId?, onBlocked? }` are used identically across Tasks 1–7. `evidencePartyId` flows: menu prop → `report/[profileId]` param → `reportUser` field. Relative import depth noted per file (`chat`/`party` at `../../../`, `home`/`proposals` at `../../`).
