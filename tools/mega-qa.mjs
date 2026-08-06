/**
 * mega-qa.mjs — Full-funnel live E2E harness for mingles v2 (rotation blind speed-dating).
 *
 * Exercises the whole designed user journey against an ALREADY-RUNNING backend:
 *   health → signup×6 (social-only: dev-login + 본인인증 + consent gate, 남3+여3)
 *   → onboarding (profile + AI preference signals) → speed-date queue/sweep (session forms)
 *   → session socket contract (per-viewer redaction, choose echo) → mutual choice
 *   → session completes → Match + DM room → messenger (REST + socket + read receipts)
 *   → date plan → moderation (report/block) → rate limiting (last).
 *
 * TIMING NOTE: the harness registers mutual choices as soon as the session forms (choose is
 * accepted in any pre-ended phase), then waits for the session's natural end for Match/DM.
 * Total wall time therefore tracks the backend's SPEEDDATE_* env. For a fast run use e.g.
 *   SPEEDDATE_STAGES=1 SPEEDDATE_PREFLIGHT_MS=2000 SPEEDDATE_ROUND_MS=5000 \
 *   SPEEDDATE_INTERMISSION_MS=1000 SPEEDDATE_DECISION_MS=3000
 * The wait ceiling is MEGA_QA_SD_MAX_WAIT_MS (default 10 minutes).
 *
 * Usage:
 *   node tools/mega-qa.mjs
 *   MEGA_QA_API=http://localhost:3000 node tools/mega-qa.mjs
 *   Requires the backend running with DEV_AUTH_ENABLED=true AND IDENTITY_DEV_BYPASS=true
 *   (social-only auth: the harness cannot perform real OAuth). SPEEDDATE_AI_FILL must be OFF
 *   for deterministic 6-human formation (AI fill would grab slots before all six enqueue) —
 *   the queue is swept clean defensively at section 4 start.
 *
 * Zero new deps: global fetch + socket.io-client (already installed in the monorepo root).
 */

import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SIO_PATH = path.join(REPO_ROOT, "node_modules/socket.io-client/build/esm/index.js");
const { io: socketIo } = await import(SIO_PATH);

// ─── Config ─────────────────────────────────────────────────────────────────

const BASE = process.env.MEGA_QA_API ?? "http://localhost:3000";
const RID = Date.now().toString(36);
const SD_MAX_WAIT_MS = Number(process.env.MEGA_QA_SD_MAX_WAIT_MS ?? 10 * 60_000);

const email = (tag) => `megaqa_${RID}_${tag}@qa.test`;
// Unique per-run phone → unique CI (identity dev bypass hashes the phone).
const phoneFor = (tag) =>
  `010${String(Math.abs(hashCode(`${RID}_${tag}`)) % 100000000).padStart(8, "0")}`;
const birthFor = (tag) => `${new Date().getFullYear() - PROFILE_SEEDS[tag].age}-01-01`;

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// ─── Tiny utilities ─────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(
  predicate,
  { timeoutMs = 8000, intervalMs = 200, label = "condition" } = {},
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await predicate();
    if (v) return v;
    if (Date.now() >= deadline) throw new Error(`timeout (${timeoutMs}ms) waiting for: ${label}`);
    await sleep(intervalMs);
  }
}

function describeErr(r) {
  return `${r.status}: ${typeof r.body === "string" ? r.body : JSON.stringify(r.body)}`;
}

function assertStatus(r, allowed, label) {
  const arr = Array.isArray(allowed) ? allowed : [allowed];
  if (!arr.includes(r.status)) {
    throw new Error(
      `${label ?? "request"} expected status ${arr.join("/")}, got ${describeErr(r)}`,
    );
  }
}

async function apiFetch(p, opts = {}) {
  const res = await fetch(`${BASE}${p}`, opts);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body };
}

function jsonHeaders(token) {
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

const post = (p, token, payload) =>
  apiFetch(p, { method: "POST", headers: jsonHeaders(token), body: JSON.stringify(payload ?? {}) });
const patch = (p, token, payload) =>
  apiFetch(p, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload ?? {}),
  });
const get = (p, token) =>
  apiFetch(p, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
const del = (p, token) =>
  apiFetch(p, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });

// ─── Check bookkeeping ──────────────────────────────────────────────────────

let checkNum = 0;
let passCount = 0;
const results = [];

async function check(name, fn) {
  checkNum++;
  let passed;
  let detail;
  try {
    const res = await fn();
    passed = true;
    detail = res ?? "";
  } catch (e) {
    passed = false;
    detail = e?.message ?? String(e);
  }
  if (passed) passCount++;
  const n = checkNum;
  console.log(`[${n}] ${passed ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  results.push({ n, name, passed, detail });
  return passed;
}

async function runSection(label, fn) {
  console.log(`\n── ${label} ──`);
  try {
    await fn();
  } catch (e) {
    await check(`${label}: section aborted`, async () => {
      throw e;
    });
  }
}

// ─── Shared funnel state ────────────────────────────────────────────────────

const users = {}; // tag -> { email, token, profileId }
let sessionId = null;
let matchId = null;
let roomId = null;
const sdSockets = {}; // tag -> { socket, snapshots: [], errors: [] }
let msgrSockets = {}; // tag -> { socket, state } (messenger gateway, separate connection)

const PROFILE_TEXT = "조용한 카페에서 차분하게 대화하며 천천히 친해지는 분위기를 좋아해요";
const PROFILE_SEEDS = {
  A: { name: "민준", age: 26, gender: "male", occupation: "개발자" },
  B: { name: "도윤", age: 27, gender: "male", occupation: "마케터" },
  C: { name: "지호", age: 28, gender: "male", occupation: "PD" },
  D: { name: "서연", age: 25, gender: "female", occupation: "디자이너" },
  E: { name: "하은", age: 24, gender: "female", occupation: "교사" },
  F: { name: "유진", age: 27, gender: "female", occupation: "간호사" },
};
const MALE_TAGS = ["A", "B", "C"];
const FEMALE_TAGS = ["D", "E", "F"];
const ALL_TAGS = [...MALE_TAGS, ...FEMALE_TAGS];

// ─── Socket helpers ─────────────────────────────────────────────────────────

function connectSpeedDateSocket(tag) {
  const socket = socketIo(BASE, {
    transports: ["websocket"],
    auth: { token: users[tag].token },
  });
  const holder = { socket, snapshots: [], errors: [] };
  socket.on("speeddate:snapshot", (e) => holder.snapshots.push(e));
  socket.on("speeddate:error", (e) => holder.errors.push(e));
  sdSockets[tag] = holder;
  return holder;
}

function latestSnapshot(tag) {
  const h = sdSockets[tag];
  if (!h) return null;
  for (let i = h.snapshots.length - 1; i >= 0; i--) {
    if (h.snapshots[i]?.sessionId === sessionId) return h.snapshots[i].snapshot;
  }
  return null;
}

function connectMessengerSocket(tag) {
  const socket = socketIo(BASE, {
    transports: ["websocket"],
    auth: { token: users[tag].token },
  });
  const state = { newMessages: [], reads: [], typings: [] };
  socket.on("message:new", (e) => state.newMessages.push(e));
  socket.on("message:read", (e) => state.reads.push(e));
  socket.on("typing", (e) => state.typings.push(e));
  return { socket, state };
}

// ─── 1. Health ──────────────────────────────────────────────────────────────

async function sectionHealth() {
  await check("Health: GET /health is ok", async () => {
    const r = await get("/health");
    assertStatus(r, 200, "health");
    if (r.body?.status !== "ok") throw new Error(`unexpected body ${JSON.stringify(r.body)}`);
    return "ok";
  });
}

// ─── 2. Signup×6 (social-only auth + gate ladder) ───────────────────────────
// Gate order (2026-07-27): identity first (provides verified age/gender) → consent → profile.

async function setupUser(tag) {
  const em = email(tag.toLowerCase());
  const seed = PROFILE_SEEDS[tag];
  users[tag] = { email: em };
  await check(`Signup ${tag}: dev-login`, async () => {
    const r = await post("/auth/dev-login", null, { email: em });
    if (r.status === 404)
      throw new Error("dev-login disabled — run the backend with DEV_AUTH_ENABLED=true");
    assertStatus(r, [200, 201], `dev-login ${tag}`);
    if (!r.body?.accessToken) throw new Error("no accessToken in dev-login response");
    users[tag].token = r.body.accessToken;
    return `email=${em}`;
  });
  await check(`Signup ${tag}: 본인인증 (dev bypass)`, async () => {
    const r = await post("/auth/identity/complete", users[tag].token, {
      name: seed.name,
      birth: birthFor(tag),
      gender: seed.gender,
      phone: phoneFor(tag),
    });
    if (r.status === 503)
      throw new Error("identity bypass disabled — run the backend with IDENTITY_DEV_BYPASS=true");
    assertStatus(r, [200, 201], `identity ${tag}`);
    return `phone=${phoneFor(tag)}`;
  });
  await check(`Signup ${tag}: consent (terms/privacy)`, async () => {
    const r = await post("/auth/consent", users[tag].token, { scopes: ["terms", "privacy"] });
    assertStatus(r, [200, 201, 204], `consent ${tag}`);
    return "consented";
  });
}

async function sectionSignup() {
  for (const tag of ALL_TAGS) await setupUser(tag);

  await check("Signup: account-status reports verified + consented", async () => {
    const r = await get("/auth/account-status", users.A.token);
    assertStatus(r, 200, "account-status");
    if (!r.body?.phoneVerifiedAt) throw new Error("phoneVerifiedAt missing after identity");
    if (!r.body?.consents?.privacy) throw new Error("privacy consent missing");
    return "verified+consented";
  });

  await check("Signup: duplicate identity (same phone/CI) → 409 (1인 1계정)", async () => {
    const dup = await post("/auth/dev-login", null, { email: email("dupci") });
    const r = await post("/auth/identity/complete", dup.body.accessToken, {
      name: "중복",
      birth: birthFor("A"),
      gender: "male",
      phone: phoneFor("A"),
    });
    assertStatus(r, 409, "dup identity CI");
    return describeErr(r);
  });

  await check("Signup: 미성년(만19 미만) 본인인증 → 403", async () => {
    const minor = await post("/auth/dev-login", null, { email: email("minor") });
    const year = new Date().getFullYear() - 15;
    const r = await post("/auth/identity/complete", minor.body.accessToken, {
      name: "미성년",
      birth: `${year}-01-01`,
      gender: "male",
      phone: `010${String(Math.abs(hashCode(`${RID}_minor`)) % 100000000).padStart(8, "0")}`,
    });
    assertStatus(r, 403, "minor identity");
    return describeErr(r);
  });

  await check("VerifiedGuard: unverified user blocked from speed-date → 403", async () => {
    const raw = await post("/auth/dev-login", null, { email: email("unverified") });
    const r = await post("/speed-date/queue", raw.body.accessToken, {});
    assertStatus(r, 403, "unverified speed-date enqueue");
    return describeErr(r);
  });
}

// ─── 3. Onboarding (profile + AI preference signals) ────────────────────────

async function sectionOnboarding() {
  for (const tag of ALL_TAGS) {
    await check(`Onboarding ${tag}: create profile (age/gender from 본인인증)`, async () => {
      const seed = PROFILE_SEEDS[tag];
      const r = await post("/profiles", users[tag].token, {
        name: seed.name,
        occupation: seed.occupation,
        partyPreferenceText: PROFILE_TEXT,
      });
      assertStatus(r, [200, 201], `profile ${tag}`);
      users[tag].profileId = r.body.id;
      if (r.body.age !== seed.age || r.body.gender !== seed.gender)
        throw new Error(
          `verified identity did not drive profile age/gender: got ${r.body.age}/${r.body.gender}`,
        );
      return `profileId=${r.body.id.slice(0, 8)}…`;
    });
  }

  await check("Onboarding: preference signals analyzed (stub or LLM)", async () => {
    const r = await get("/profiles/me", users.A.token);
    assertStatus(r, 200, "profiles/me");
    const sig = r.body?.preferenceSignals;
    if (!sig?.vibe) throw new Error("preferenceSignals missing after create");
    return `vibe=${sig.vibe} pace=${sig.pace}`;
  });

  await check("Onboarding: duplicate profile → 409", async () => {
    const seed = PROFILE_SEEDS.A;
    const r = await post("/profiles", users.A.token, {
      name: seed.name,
      occupation: seed.occupation,
      partyPreferenceText: PROFILE_TEXT,
    });
    assertStatus(r, 409, "duplicate profile");
    return describeErr(r);
  });
}

// ─── 4. Speed-date queue → session forms ────────────────────────────────────
// speed-date-queue.service.ts (enqueue gates) + speed-date.sweep.ts (3+3 formation with the
// wait-decayed preference threshold; same-text profiles score 1.0 so the gate passes instantly).

async function sectionSpeedDateQueue() {
  await check("Queue: stale waiting entries cancelled (shared queue hygiene)", async () => {
    for (const tag of ALL_TAGS) await del("/speed-date/queue", users[tag].token);
    return "cancelled any leftovers";
  });

  // 5명까지만 먼저 넣고 dup을 검사한다 — 6명이 차면 형성 sweep이 waiting을 소비해
  // 중복 검사가 타이밍 레이스에 걸린다(형성과 dup 409는 별개 불변식).
  const firstFive = ALL_TAGS.slice(0, 5);
  for (const tag of firstFive) {
    await check(`Queue: ${tag} enqueues`, async () => {
      const r = await post("/speed-date/queue", users[tag].token, {});
      assertStatus(r, [200, 201], `enqueue ${tag}`);
      return r.body?.status ?? "queued";
    });
  }

  await check("Queue: duplicate enqueue is idempotent (single waiting entry)", async () => {
    // enqueue는 기존 waiting을 발견하면 조용히 성공(멱등) — 409는 동시성 레이스(P2002)나
    // 활성 세션 참가 중일 때만. 불변식은 '두 번째 waiting entry가 생기지 않는다'다.
    const r = await post("/speed-date/queue", users.A.token, {});
    assertStatus(r, [200, 201], "duplicate enqueue idempotent");
    const st = await get("/speed-date/status", users.A.token);
    if (st.body?.status !== "waiting") throw new Error(`status=${st.body?.status} after dup`);
    return "idempotent, still one waiting";
  });

  await check(`Queue: ${ALL_TAGS[5]} enqueues (완성 인원)`, async () => {
    const r = await post("/speed-date/queue", users[ALL_TAGS[5]].token, {});
    assertStatus(r, [200, 201], "final enqueue");
    return r.body?.status ?? "queued";
  });

  await check("Sweep: session forms for 남3+여3 (status=matched)", async () => {
    await waitFor(
      async () => {
        const r = await get("/speed-date/status", users.A.token);
        if (r.body?.status === "matched" && r.body.sessionId) {
          sessionId = r.body.sessionId;
          return true;
        }
        return false;
      },
      { timeoutMs: 30000, intervalMs: 1000, label: "session formation" },
    );
    return `sessionId=${sessionId.slice(0, 8)}…`;
  });

  await check("Sweep: all six report the SAME session", async () => {
    for (const tag of ALL_TAGS) {
      const r = await get("/speed-date/status", users[tag].token);
      if (r.body?.sessionId !== sessionId)
        throw new Error(`${tag} sees ${r.body?.sessionId} != ${sessionId}`);
    }
    return "6/6 matched to one session";
  });
}

// ─── 5. Session socket contract (redaction + choose echo) ───────────────────
// speed-date.gateway.ts + speed-date.state.ts snapshotFor: per-viewer redaction — nickname-only
// partners, my own choices only, no real names/photos before the DM.

async function sectionSessionContract() {
  await check("Socket: six clients join + receive snapshots", async () => {
    for (const tag of ALL_TAGS) {
      const h = connectSpeedDateSocket(tag);
      await waitFor(() => h.socket.connected, { timeoutMs: 5000, label: `${tag} connect` });
      h.socket.emit("speeddate:join", { sessionId });
      h.socket.emit("speeddate:sync", { sessionId });
    }
    await waitFor(() => ALL_TAGS.every((t) => latestSnapshot(t)), {
      timeoutMs: 8000,
      label: "all snapshots",
    });
    return "6 sockets snapshotting";
  });

  await check("Redaction: snapshot exposes nicknames, never real names", async () => {
    const snap = latestSnapshot("A");
    const text = JSON.stringify(snap);
    for (const tag of ALL_TAGS) {
      if (text.includes(PROFILE_SEEDS[tag].name))
        throw new Error(`real name ${PROFILE_SEEDS[tag].name} leaked in snapshot`);
    }
    if (!snap.phase) throw new Error("no phase in snapshot");
    return `phase=${snap.phase}, redacted`;
  });

  await check("Choose: echo is private to the chooser", async () => {
    const target = users.D.profileId;
    sdSockets.A.socket.emit("speeddate:choose", { sessionId, targetProfileId: target, on: true });
    await waitFor(
      () => latestSnapshot("A")?.myChoices?.includes(target),
      { timeoutMs: 5000, label: "A choose echo" },
    );
    const snapB = latestSnapshot("B");
    if (snapB?.myChoices?.includes(target))
      throw new Error("B's snapshot leaked A's choice — choices must be per-viewer");
    return "choice echoed to A only";
  });

  await check("Choose: same-gender target rejected (no state change)", async () => {
    sdSockets.A.socket.emit("speeddate:choose", {
      sessionId,
      targetProfileId: users.B.profileId,
      on: true,
    });
    await sleep(800);
    if (latestSnapshot("A")?.myChoices?.includes(users.B.profileId))
      throw new Error("same-gender choice was accepted");
    return "rejected";
  });
}

// ─── 6. Mutual choice → session end → Match + DM ────────────────────────────
// speed-date-session.service.ts resolveDecision → mutualPairs → MatchService.createMatch.

async function sectionMutualMatch() {
  await check("Mutual: A↔D 상호선택 등록", async () => {
    sdSockets.A.socket.emit("speeddate:choose", {
      sessionId,
      targetProfileId: users.D.profileId,
      on: true,
    });
    sdSockets.D.socket.emit("speeddate:choose", {
      sessionId,
      targetProfileId: users.A.profileId,
      on: true,
    });
    await waitFor(
      () =>
        latestSnapshot("A")?.myChoices?.includes(users.D.profileId) &&
        latestSnapshot("D")?.myChoices?.includes(users.A.profileId),
      { timeoutMs: 5000, label: "mutual choices echoed" },
    );
    return "A→D, D→A registered";
  });

  await check("Session: runs to ended with the mutual match in the result", async () => {
    const snap = await waitFor(
      () => {
        // sync 주기적 재요청 — 스냅샷 push는 phase 전이 sweep마다 오지만 보수적으로 당긴다.
        sdSockets.A.socket.emit("speeddate:sync", { sessionId });
        const s = latestSnapshot("A");
        return s?.phase === "ended" ? s : null;
      },
      { timeoutMs: SD_MAX_WAIT_MS, intervalMs: 2000, label: "session ended" },
    );
    const mine = snap.result?.matches ?? [];
    if (!mine.length) throw new Error("no mutual match in ended result");
    roomId = mine[0].roomId;
    if (mine[0].profileId !== users.D.profileId)
      throw new Error(`unexpected match peer ${mine[0].profileId}`);
    return `roomId=${roomId?.slice(0, 8)}…`;
  });

  await check("Match: /messenger/rooms lists the pair for both sides", async () => {
    const rA = await get("/messenger/rooms", users.A.token);
    assertStatus(rA, 200, "matches A");
    const mA = (rA.body ?? []).find((m) => m.roomId === roomId);
    if (!mA) throw new Error("A's match list missing the speed-date match");
    matchId = mA.matchId ?? mA.id;
    const rD = await get("/messenger/rooms", users.D.token);
    if (!(rD.body ?? []).some((m) => m.roomId === roomId))
      throw new Error("D's match list missing the speed-date match");
    return `matchId=${String(matchId).slice(0, 8)}…`;
  });
}

// ─── 7. Messenger ───────────────────────────────────────────────────────────

async function sectionMessenger() {
  if (!roomId) throw new Error("no roomId — mutual match did not complete");

  let msgId1 = null;
  await check("Messenger: A sends DM via REST", async () => {
    const content = `hi-D-${RID}`;
    const r = await post(`/messenger/rooms/${roomId}/messages`, users.A.token, { content });
    assertStatus(r, 201, "A sends DM");
    msgId1 = r.body.id;
    return `messageId=${msgId1}`;
  });

  await check("Messenger: D reads history via REST", async () => {
    const r = await get(`/messenger/rooms/${roomId}/messages`, users.D.token);
    assertStatus(r, 200, "D history");
    if (!(r.body ?? []).some((m) => m.id === msgId1)) throw new Error("D missing A's message");
    return `history=${r.body.length}`;
  });

  await check("Messenger: socket delivers message:new to D", async () => {
    msgrSockets = { A: connectMessengerSocket("A"), D: connectMessengerSocket("D") };
    await waitFor(() => msgrSockets.A.socket.connected && msgrSockets.D.socket.connected, {
      timeoutMs: 5000,
      label: "messenger sockets",
    });
    msgrSockets.D.socket.emit("room:join", { roomId });
    msgrSockets.A.socket.emit("room:join", { roomId });
    await sleep(300);
    const content = `socket-msg-${RID}`;
    const r = await post(`/messenger/rooms/${roomId}/messages`, users.A.token, { content });
    assertStatus(r, 201, "A socket-era DM");
    const msgId2 = r.body.id;
    await waitFor(() => msgrSockets.D.state.newMessages.some((e) => e.message?.id === msgId2), {
      timeoutMs: 6000,
      label: "message:new at D",
    });
    return "delivered";
  });

  await check("Messenger: read receipt round-trips to A", async () => {
    const r = await post(`/messenger/rooms/${roomId}/read`, users.D.token, {});
    assertStatus(r, [200, 201, 204], "D read");
    await waitFor(() => msgrSockets.A.state.reads.length > 0, {
      timeoutMs: 6000,
      label: "message:read at A",
    });
    const hist = await get(`/messenger/rooms/${roomId}/messages`, users.A.token);
    const mine = (hist.body ?? []).filter((m) => m.senderProfileId === users.A.profileId);
    if (!mine.some((m) => m.readAt)) throw new Error("A's messages show no readAt after D read");
    return "read receipt propagated";
  });

  await check("Messenger: blocked pair cannot DM (403 after block)", async () => {
    const b = await post("/safety/blocks", users.D.token, {
      blockedProfileId: users.A.profileId,
    });
    assertStatus(b, [200, 201], "D blocks A");
    const r = await post(`/messenger/rooms/${roomId}/messages`, users.A.token, {
      content: "blocked?",
    });
    assertStatus(r, 403, "blocked DM");
    await del(`/safety/blocks/${users.A.profileId}`, users.D.token);
    return "block enforced on DM; unblocked for later sections";
  });
}

// ─── 8. Date plan ───────────────────────────────────────────────────────────

async function sectionDatePlan() {
  if (!matchId) throw new Error("no matchId — mutual match did not complete");

  let planId = null;
  let courseId = null;
  await check("DatePlan: A creates a plan (template courses)", async () => {
    const r = await post("/date-plans", users.A.token, {
      matchId,
      budget: { total: 60000, currency: "KRW" },
      location: { city: "서울", district: "성수" },
      dateTime: { preferredDate: "2026-08-20", durationHours: 3 },
    });
    assertStatus(r, [200, 201], "create plan");
    planId = r.body.id;
    courseId = r.body.courses?.[0]?.courseId;
    if (!courseId) throw new Error("no courses in created plan");
    return `planId=${planId.slice(0, 8)}… courses=${r.body.courses.length}`;
  });

  await check("DatePlan: A selects a course (selectedCourseId set, status stays draft)", async () => {
    const r = await patch(`/date-plans/${planId}/select`, users.A.token, { courseId });
    assertStatus(r, 200, "select course");
    if (r.body.selectedCourseId !== courseId)
      throw new Error(`selectedCourseId=${r.body.selectedCourseId} after select`);
    if (r.body.status !== "draft") throw new Error(`status=${r.body.status} (confirm이 상태를 바꾼다)`);
    return "selected, awaiting peer confirm";
  });

  await check("DatePlan: D confirms (only the peer can)", async () => {
    const self = await patch(`/date-plans/${planId}/confirm`, users.A.token, {});
    assertStatus(self, 403, "self-confirm must 403");
    const r = await patch(`/date-plans/${planId}/confirm`, users.D.token, {});
    assertStatus(r, 200, "peer confirm");
    if (r.body.status !== "confirmed") throw new Error(`status=${r.body.status} after confirm`);
    return "confirmed";
  });

  await check("DatePlan: non-member cannot read (403/404)", async () => {
    const r = await get(`/date-plans/${planId}`, users.B.token);
    assertStatus(r, [403, 404], "outsider read");
    return describeErr(r);
  });
}

// ─── 9. Moderation ──────────────────────────────────────────────────────────

async function sectionModeration() {
  await check("Moderation: E reports F", async () => {
    const r = await post("/safety/report", users.E.token, {
      reportedProfileId: users.F.profileId,
      reason: "other",
      details: `mega-qa smoke ${RID}`,
    });
    assertStatus(r, [200, 201], "report");
    return `reportId=${r.body.id?.slice(0, 8)}…`;
  });

  await check("Moderation: self-report rejected (400)", async () => {
    const r = await post("/safety/report", users.E.token, {
      reportedProfileId: users.E.profileId,
      reason: "other",
    });
    assertStatus(r, 400, "self report");
    return describeErr(r);
  });

  await check("Moderation: block → list → unblock cycle", async () => {
    const b = await post("/safety/blocks", users.E.token, {
      blockedProfileId: users.F.profileId,
    });
    assertStatus(b, [200, 201], "block");
    const list = await get("/safety/blocks", users.E.token);
    if (!(list.body ?? []).some((x) => x.profileId === users.F.profileId))
      throw new Error("blocked profile missing from list");
    const u = await del(`/safety/blocks/${users.F.profileId}`, users.E.token);
    assertStatus(u, [200, 204], "unblock");
    const after = await get("/safety/blocks", users.E.token);
    if ((after.body ?? []).length !== 0) throw new Error("blocks not empty after unblock");
    return "block cycle ok";
  });
}

// ─── 10. Rate limit (LAST — pollutes the shared-IP counters) ────────────────

async function sectionRateLimit() {
  await check("Rate limit: spam POST /auth/social until 429", async () => {
    let got429 = null;
    for (let i = 0; i < 40; i++) {
      const r = await post("/auth/social", null, {
        provider: "kakao",
        code: "x",
        redirectUri: "http://localhost/cb",
      });
      if (r.status === 429) {
        got429 = i + 1;
        break;
      }
    }
    if (!got429) throw new Error("never rate-limited after 40 attempts");
    return `429 arrived after ${got429} attempt(s)`;
  });

  await check("Rate limit: GET /health stays 200 despite social spam", async () => {
    const r = await get("/health");
    assertStatus(r, 200, "health post-spam");
    return `status=${r.status}`;
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const started = Date.now();
  console.log(`MEGA-QA (speed-date funnel) against ${BASE} — run ${RID}`);

  await runSection("1. Health", sectionHealth);
  await runSection("2. Signup×6 (social-only + gate ladder)", sectionSignup);
  await runSection("3. Onboarding", sectionOnboarding);
  await runSection("4. Speed-date queue → session", sectionSpeedDateQueue);
  await runSection("5. Session socket contract", sectionSessionContract);
  await runSection("6. Mutual choice → Match + DM", sectionMutualMatch);
  await runSection("7. Messenger", sectionMessenger);
  await runSection("8. Date plan", sectionDatePlan);
  await runSection("9. Moderation", sectionModeration);
  await runSection("10. Rate limit (last)", sectionRateLimit);

  for (const h of Object.values(sdSockets)) h.socket?.disconnect();
  for (const h of Object.values(msgrSockets)) h.socket?.disconnect();

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nMEGA-QA: ${passCount}/${checkNum} PASS (${secs}s)`);
  if (passCount !== checkNum) {
    console.log("\nFailures:");
    for (const r of results.filter((x) => !x.passed))
      console.log(`  [${r.n}] ${r.name} — ${r.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("harness crashed:", e);
  process.exit(1);
});
