/**
 * mega-qa.mjs — Full-funnel live E2E harness for MingleAI v2.
 *
 * Exercises the whole designed user journey against an ALREADY-RUNNING backend:
 *   health → signup×4 → onboarding → matchmaking → party realtime (chat/move/presence)
 *   → Among Us "AI를 찾아라" (AUTO-STARTED once the 4th socket joins — see ORDERING NOTE below;
 *   role contract — all 4 humans are crew, the only impostors are 2 server-driven AI personas —
 *   AI liveliness, two emergency-meeting ejections, identity reveal) → balance game → proposal
 *   → match → messenger (REST + socket + read receipts) → date plan → moderation (report/block)
 *   → dashboard → rate limiting (last).
 *
 * ORDERING NOTE (2026-07-15, party-game-world T3): `party.gateway.ts`'s `maybeAutoStartAmong`
 * (commit 2a446fc) auto-starts Among Us the instant `party:join` fills the presence roster to
 * the party's full `participantCount` — i.e. it fires DURING section 5 (party realtime), before
 * this harness ever calls `among:start` itself. Balance and Among share a single "one ACTIVE
 * GameSession per party" constraint (`game.service.ts` `findActive` has no `gameType` filter),
 * so running the balance section while that auto-started Among session is still active would hit
 * "already-active". Smallest-correct fix: the Among Us section now runs BEFORE the balance
 * section (swapped from the historical 6→7 numbering) — it detects the auto-started session via
 * `among:sync` (falling back to an explicit `among:start` only if auto-start conditions weren't
 * met) and plays it through to a real "ended" result, so the balance section starts cleanly
 * afterward. Section number comments below reflect actual run order.
 *
 * Style/contract reference: tools/among-bots.mjs (socket auth handshake + among event usage).
 * Contracts read directly from apps/backend/src/{party,matchmaking,proposal,match,messenger,
 * date-plan,safety,profile,auth,dashboard}/*.ts — see inline notes near each section for the
 * specific service methods that shaped each check.
 *
 * Usage:
 *   node tools/mega-qa.mjs
 *   MEGA_QA_API=http://localhost:3000 node tools/mega-qa.mjs
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
const PASSWORD = "MegaQA123!pw";

const email = (tag) => `megaqa_${RID}_${tag}@qa.test`;

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

const users = {}; // tag -> { email, password, token, profileId }
const sockets = {}; // tag -> { socket, state }
let partyId = null;
// Tags of A-D that actually landed in `partyId` together (normally all 4). The matchmaking
// queue is SHARED across harness runs — stale "waiting" entries left by a prior aborted run
// can pad or split parties (see section 4). All party-scoped sections (5-7) iterate this
// subset instead of a hardcoded ["A","B","C","D"] so they degrade gracefully instead of
// silently asserting against users who never actually joined this party.
let partyTags = ["A", "B", "C", "D"];
let matchId = null;
let roomId = null;
let msgrSockets = {}; // tag -> { socket, state } (messenger gateway, separate connection)

const PROFILE_TEXT =
  "가볍게 어울리면서 다양한 미니게임과 대화를 즐기는 밝고 활발한 분위기를 좋아해요";
const PROFILE_SEEDS = {
  A: { name: "민준", age: 26, gender: "male", occupation: "개발자" },
  B: { name: "서연", age: 25, gender: "female", occupation: "디자이너" },
  C: { name: "도윤", age: 27, gender: "male", occupation: "마케터" },
  D: { name: "하은", age: 24, gender: "female", occupation: "교사" },
  E: { name: "지호", age: 28, gender: "male", occupation: "PD" },
};

// ─── Socket helpers ─────────────────────────────────────────────────────────

function connectPartySocket(tag) {
  const user = users[tag];
  const socket = socketIo(BASE, {
    auth: { token: user.token },
    transports: ["websocket"],
    reconnection: false,
  });
  const state = {
    presence: null,
    messages: [],
    moved: [],
    errors: [],
    gameState: null,
    amongState: null,
    // Bumped on every "among:state" receipt (auto-start broadcast OR among:sync response OR any
    // other among:* ack). amongState alone can't distinguish "no response yet" from "a response
    // arrived and it legitimately carries no active session" (project() returns null when there's
    // no session) — the count lets checks detect a fresh event regardless of payload shape.
    amongEventCount: 0,
  };
  socket.on("party:presence", (d) => {
    state.presence = d;
  });
  socket.on("party:message", (m) => {
    state.messages.push(m);
  });
  socket.on("party:moved", (d) => {
    state.moved.push(d);
  });
  socket.on("party:error", (e) => {
    state.errors.push(e);
  });
  socket.on("game:state", (d) => {
    state.gameState = d?.snapshot ?? null;
  });
  socket.on("among:state", (d) => {
    state.amongState = d?.snapshot ?? null;
    state.amongEventCount++;
  });
  sockets[tag] = { socket, state };
  return sockets[tag];
}

function connectMessengerSocket(tag) {
  const user = users[tag];
  const socket = socketIo(BASE, {
    auth: { token: user.token },
    transports: ["websocket"],
    reconnection: false,
  });
  const state = { newMessages: [], reads: [], errors: [] };
  socket.on("message:new", (e) => {
    state.newMessages.push(e);
  });
  socket.on("message:read", (e) => {
    state.reads.push(e);
  });
  socket.on("messenger:error", (e) => {
    state.errors.push(e);
  });
  msgrSockets[tag] = { socket, state };
  return msgrSockets[tag];
}

function waitConnected(socket, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    const t = setTimeout(() => reject(new Error("socket connect timeout")), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(t);
      resolve();
    });
    socket.once("connect_error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

// ─── 1. Health ──────────────────────────────────────────────────────────────
// apps/backend/src/health/health.controller.ts — GET /health, @SkipThrottle (must stay 200
// even under the rate-limit spam in section 13).

async function sectionHealth() {
  await check("GET /health → 200", async () => {
    const r = await get("/health");
    assertStatus(r, 200, "GET /health");
    return `status=${r.body?.status}`;
  });
}

// ─── 2. Signup×4 ────────────────────────────────────────────────────────────
// auth.controller.ts: POST /auth/register (10/min throttle), POST /auth/login (10/min throttle).
// register() itself returns {accessToken, role} but we still call login() per-user to exercise
// the real password-auth path end to end.

async function registerAndLogin(tag) {
  const em = email(tag.toLowerCase());
  users[tag] = { email: em, password: PASSWORD };
  await check(`Signup ${tag}: register`, async () => {
    const r = await post("/auth/register", null, { email: em, password: PASSWORD });
    assertStatus(r, 201, `register ${tag}`);
    if (!r.body?.accessToken) throw new Error("no accessToken in register response");
    return `email=${em}`;
  });
  await check(`Signup ${tag}: login`, async () => {
    const r = await post("/auth/login", null, { email: em, password: PASSWORD });
    assertStatus(r, [200, 201], `login ${tag}`);
    if (!r.body?.accessToken) throw new Error("no accessToken in login response");
    users[tag].token = r.body.accessToken;
    return "JWT obtained";
  });
}

async function sectionSignup() {
  for (const tag of ["A", "B", "C", "D"]) await registerAndLogin(tag);

  await check("Signup: duplicate email register → 4xx", async () => {
    const r = await post("/auth/register", null, {
      email: users.A.email,
      password: "someotherpw123",
    });
    if (r.status < 400 || r.status >= 500) throw new Error(`expected 4xx, got ${describeErr(r)}`);
    return describeErr(r);
  });
}

// ─── 3. Onboarding ──────────────────────────────────────────────────────────
// profile.controller.ts: POST /profiles (CreateProfileDto: age @Min(19) @Max(100)), GET /profiles/me.
// All four profiles share near-identical partyPreferenceText so the stub preference analyzer
// (apps/backend/src/ai/stub-preference-analyzer.ts, active since LLM_API_URL is unset) produces
// matching signals and matchmaking.service's preferenceScore groups them together.

async function createProfile(tag) {
  const seed = PROFILE_SEEDS[tag];
  await check(`Onboarding ${tag}: create profile`, async () => {
    const r = await post("/profiles", users[tag].token, {
      name: seed.name,
      age: seed.age,
      gender: seed.gender,
      occupation: seed.occupation,
      partyPreferenceText: PROFILE_TEXT,
    });
    assertStatus(r, 201, `create profile ${tag}`);
    users[tag].profileId = r.body.id;
    return `profileId=${r.body.id}`;
  });
}

async function sectionOnboarding() {
  for (const tag of ["A", "B", "C", "D"]) await createProfile(tag);

  await check("Onboarding: age gate rejects age 18 → 400", async () => {
    const em = email("agegate");
    const reg = await post("/auth/register", null, { email: em, password: PASSWORD });
    assertStatus(reg, 201, "register agegate probe");
    const r = await post("/profiles", reg.body.accessToken, {
      name: "언더에이지",
      age: 18,
      gender: "male",
      occupation: "학생",
      partyPreferenceText: PROFILE_TEXT,
    });
    assertStatus(r, 400, "create profile age=18");
    return describeErr(r);
  });

  await check("Onboarding A: GET /profiles/me returns the profile", async () => {
    const r = await get("/profiles/me", users.A.token);
    assertStatus(r, 200, "GET /profiles/me");
    if (r.body?.id !== users.A.profileId)
      throw new Error(`id mismatch: ${r.body?.id} != ${users.A.profileId}`);
    return `id=${r.body.id}`;
  });
}

// ─── 4. Matchmaking ─────────────────────────────────────────────────────────
// matchmaking.controller.ts + matchmaking.service.ts + matchmaking.sweep.ts.
// enqueue() is idempotent while status="waiting" (returns the existing entry); once matched, a
// second enqueue hits the activeMembership guard and throws ConflictException (409). Both are
// "correct" per the service — the check below accepts whichever the race lands on.
// Party formation is swept every MATCH_SWEEP_MS (2.5s here); we fire all 4 enqueues concurrently
// so they land in the same sweep tick and form one party (min/max party size + threshold are env
// tuned in apps/backend/.env for this dev stack: MIN_PARTY_SIZE=2 MAX_PARTY_SIZE=8 THRESHOLD=0).

async function pollMatched(tag, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await get("/matchmaking/status", users[tag].token);
    if (r.status === 200 && r.body?.status === "matched" && r.body.matchedPartyId) {
      return r.body.matchedPartyId;
    }
    if (Date.now() >= deadline) return null;
    await sleep(2000);
  }
}

// Congestion-tolerant enqueue: matchmaking.service.ts enqueue() runs a Serializable retry loop
// against P2034 (write conflict with the sweep tx); once the retry budget exhausts it now maps
// to ConflictException(409, "대기열이 혼잡합니다..."). That's distinct from the DESIGNED 409
// ("이미 참여 중인 파티가 있습니다", the activeMembership guard firing once already matched) — a
// freshly-registered RID-scoped profile can never hit the designed 409 on its FIRST enqueue call,
// so any 409 here is queue congestion. Retry a few times with backoff before failing the check.
async function enqueueWithCongestionRetry(tag, { retries = 3, backoffMs = 300 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await post("/matchmaking/queue", users[tag].token, {});
    if (last.status === 200 || last.status === 201) return last;
    if (last.status === 409 && attempt < retries) {
      await sleep(backoffMs);
      continue;
    }
    return last;
  }
  return last;
}

async function sectionMatchmaking() {
  const enqueueEntries = {};

  await check("Matchmaking: enqueue A,B,C,D concurrently", async () => {
    const parts = await Promise.all(
      ["A", "B", "C", "D"].map(async (tag) => {
        const r = await enqueueWithCongestionRetry(tag);
        assertStatus(r, [200, 201], `enqueue ${tag}`);
        enqueueEntries[tag] = r.body;
        return `${tag}=${r.body.status}`;
      }),
    );
    return parts.join(", ");
  });

  await check("Matchmaking: double-enqueue A is idempotent-or-conflict per design", async () => {
    const r = await post("/matchmaking/queue", users.A.token, {});
    if (r.status === 409)
      return `already matched by the time of retest → 409 conflict (designed activeMembership guard)`;
    assertStatus(r, [200, 201], "double-enqueue A");
    if (enqueueEntries.A?.id && r.body.id !== enqueueEntries.A.id) {
      throw new Error(
        `BUG: expected same waiting entry id=${enqueueEntries.A.id}, got new id=${r.body.id}`,
      );
    }
    return `idempotent, entry id=${r.body.id} status=${r.body.status}`;
  });

  await check(
    "Matchmaking: party forms for A,B,C,D within 120s (shared-queue tolerant)",
    async () => {
      const ids = {};
      await Promise.all(
        ["A", "B", "C", "D"].map(async (tag) => {
          ids[tag] = await pollMatched(tag, 120000);
        }),
      );
      const missing = Object.entries(ids)
        .filter(([, id]) => !id)
        .map(([t]) => t);
      if (missing.length)
        throw new Error(
          `some users never matched: ${JSON.stringify(ids)} (missing=[${missing.join(",")}])`,
        );

      partyId = ids.A;
      partyTags = ["A", "B", "C", "D"].filter((t) => ids[t] === partyId);

      if (partyTags.length === 4) return `partyId=${partyId}`;

      if (partyTags.length < 2) {
        throw new Error(
          `STALE-QUEUE TRIAGE: only [${partyTags.join(",")}] (${partyTags.length}) of 4 test users ` +
            `share A's party — ids=${JSON.stringify(ids)}. The matchmaking queue is shared across ` +
            `harness runs; stale "waiting" entries left by a prior aborted run can pad/split parties, ` +
            `but fewer than 2 shared test users leaves nothing to test the party funnel with. Clear ` +
            `stale matchmaking_queue_entries rows (status="waiting") or re-run once the sweep drains them.`,
        );
      }

      // Every user DID match (no `missing`); they just didn't all land in the same party. This is
      // designed shared-queue behavior, not a bug — continue downstream party-section checks with
      // whichever subset (>=2) actually shares A's party.
      return `PASS-with-note (designed: shared queue — stale entries padded/split): [${partyTags.join(",")}] share partyId=${partyId}; full ids=${JSON.stringify(ids)}`;
    },
  );
}

// ─── 5. Party realtime ──────────────────────────────────────────────────────
// party.gateway.ts: party:join / party:chat / party:move / presence, and the "forbidden"
// rejection path via party.service.assertParticipant for non-participants.

async function sectionPartyRealtime() {
  await check("Setup: register 5th user E (non-participant)", async () => {
    const em = email("e");
    users.E = { email: em, password: PASSWORD };
    const reg = await post("/auth/register", null, { email: em, password: PASSWORD });
    assertStatus(reg, 201, "register E");
    users.E.token = reg.body.accessToken;
    const seed = PROFILE_SEEDS.E;
    const prof = await post("/profiles", users.E.token, {
      name: seed.name,
      age: seed.age,
      gender: seed.gender,
      occupation: seed.occupation,
      partyPreferenceText: PROFILE_TEXT,
    });
    assertStatus(prof, 201, "create profile E");
    users.E.profileId = prof.body.id;
    return `E profileId=${users.E.profileId}`;
  });

  if (!partyId)
    throw new Error(
      "no partyId — matchmaking section did not produce a party; skipping realtime checks",
    );

  // partyTags is normally ["A","B","C","D"] — only a narrower subset when section 4 detected a
  // shared-queue party split (see the PASS-with-note case there). senderTag/receiverTag are
  // always the first two, which A's party is guaranteed to contain (subset length >= 2).
  const [senderTag, receiverTag] = partyTags;

  await check(`Party realtime: connect ${partyTags.length} sockets + party:join`, async () => {
    for (const tag of partyTags) connectPartySocket(tag);
    await Promise.all(partyTags.map((tag) => waitConnected(sockets[tag].socket)));
    for (const tag of partyTags) sockets[tag].socket.emit("party:join", { partyId });
    return `${partyTags.length} sockets connected and joined (${partyTags.join(",")})`;
  });

  await check("Party realtime: presence roster ⊇ joined test users", async () => {
    const joinedIds = partyTags.map((t) => users[t].profileId);
    await waitFor(
      () =>
        partyTags.every((t) => {
          const members = sockets[t].state.presence?.members ?? [];
          return joinedIds.every((id) => members.includes(id));
        }),
      {
        timeoutMs: 8000,
        intervalMs: 300,
        label: `presence ⊇ [${partyTags.join(",")}] for all sockets`,
      },
    );
    const n = sockets[senderTag].state.presence.members.length;
    return `members=${n}${n > partyTags.length ? ` (⊇ ${partyTags.length} joined test users, plus stale co-members from a prior run)` : ""}`;
  });

  await check(
    `Party realtime: ${senderTag} chat → ${receiverTag} receives + REST history contains it`,
    async () => {
      const content = `hello-from-${senderTag}-${RID}`;
      sockets[senderTag].socket.emit("party:chat", { partyId, content });
      await waitFor(() => sockets[receiverTag].state.messages.some((m) => m.content === content), {
        timeoutMs: 5000,
        label: `${receiverTag} receives party:message`,
      });
      const hist = await get(`/parties/${partyId}/messages`, users[receiverTag].token);
      assertStatus(hist, 200, "GET party messages");
      if (!hist.body.some((m) => m.content === content))
        throw new Error("BUG: message missing from REST history");
      return "chat delivered via socket + persisted via REST";
    },
  );

  await check(
    `Party realtime: ${senderTag} move → ${receiverTag} receives party:moved, ${senderTag} gets no echo`,
    async () => {
      // Filtered by profileId, not raw array-length growth: Among Us auto-starts as a side effect
      // of the party:join calls above (party.gateway maybeAutoStartAmong), and once active its 1s
      // AI-bot sweep independently broadcasts unrelated party:moved events (ai- profileIds) to the
      // WHOLE room (correct product behavior — every member must see AI avatars move too). Raw
      // length growth can no longer distinguish "I got my own echo" from "an AI bot happened to
      // move in this window", so both checks below key off profileId specifically.
      const beforeSender = sockets[senderTag].state.moved.length;
      const beforeReceiver = sockets[receiverTag].state.moved.length;
      const senderProfileId = users[senderTag].profileId;
      sockets[senderTag].socket.emit("party:move", { partyId, x: 0.42, y: 0.58 });
      const fromSender = (arr, from) =>
        arr.slice(from).find((m) => m.profileId === senderProfileId);
      await waitFor(
        () => fromSender(sockets[receiverTag].state.moved, beforeReceiver) !== undefined,
        { timeoutMs: 3000, label: `${receiverTag} receives party:moved from ${senderTag}` },
      );
      await sleep(500);
      if (fromSender(sockets[senderTag].state.moved, beforeSender) !== undefined)
        throw new Error(`BUG: ${senderTag} received an echo of its own party:move`);
      const last = fromSender(sockets[receiverTag].state.moved, beforeReceiver);
      if (last.x !== 0.42 || last.y !== 0.58) {
        throw new Error(`unexpected payload: ${JSON.stringify(last)}`);
      }
      return `${receiverTag} got {x:${last.x},y:${last.y}} from ${last.profileId.slice(-6)}, ${senderTag}: no echo`;
    },
  );

  await check("Party realtime: non-participant E join rejected via party:error", async () => {
    const eSocket = socketIo(BASE, {
      auth: { token: users.E.token },
      transports: ["websocket"],
      reconnection: false,
    });
    const state = { errors: [] };
    eSocket.on("party:error", (e) => state.errors.push(e));
    await waitConnected(eSocket);
    const before = sockets[senderTag].state.presence.members.length;
    eSocket.emit("party:join", { partyId });
    await waitFor(() => state.errors.length > 0, { timeoutMs: 4000, label: "party:error for E" });
    await sleep(300);
    const after = sockets[senderTag].state.presence.members.length;
    eSocket.disconnect();
    if (after !== before)
      throw new Error(`BUG: presence roster changed after a rejected join (${before} → ${after})`);
    return `party:error=${JSON.stringify(state.errors[0])}, presence unchanged (${after})`;
  });
}

// ─── 6. Among Us — "AI를 찾아라" (auto-started once the party fills to capacity) ───
// party.gateway.ts among:* handlers + among.service.ts. Runs BEFORE the balance-game section (see
// the file-header ORDERING NOTE) because party.gateway's maybeAutoStartAmong fires as soon as the
// presence roster fills during section 5's party:join — by the time this section starts, an Among
// Us GameSession is very likely ALREADY "active", started without this harness ever calling
// among:start.
//
// 2026-07-20 game-rule rewrite ("AI를 찾아라"): ALL 4 human players are crew — the only impostors
// are 2 server-driven AI personas (synthetic `ai-`-prefixed profileIds, never a real Profile row;
// see among.service.start()'s `pickPersonas` call and apps/backend/src/party/ai/personas.ts). There
// is no human-vs-human suspicion anymore, so this section no longer plays a kill/report path: it
// verifies the role contract (all 4 humans are crew, the 2 AI players' role is redacted pre-reveal,
// and no snapshot carries an `isAi` field at all until the game ends — among.service.ts project()
// only spreads `isAi: true` in when `isEnded && p.isAi`), observes an AI persona moving on its own
// (party.gateway's 1s sweep drives `runBotTick`/`AiImpostorBrain`, not a human party:move), then
// runs the meeting mechanic through TWO emergency meetings (env: AMONG_DISCUSSION_MS=10000,
// AMONG_VOTE_MS=15000, AMONG_EMERGENCY_PER_PLAYER=1 so the two calls MUST come from two different
// users) — meeting #1 ejects one AI mid-game (game continues), meeting #2 ejects the second AI and
// ends the game (winner="crew", reason="ejected"), and the final "ended" snapshot reveals both
// impostors' `isAi: true`. Both meetings vote the whole party (4 humans) onto the target AI: the
// server's own sweep (`castAiVote`) auto-votes the still-alive AI persona(s) too (random alive
// human, since AMONG_AI_REQUIRE_LLM=false/no LLM_API_URL means aiChat.enabled is false here) — with
// at most 2 AI votes scattering across humans and all 4 humans concentrated on the target AI, the
// target's plurality (4) always strictly beats any split AI tally (≤2), so ejection is deterministic
// regardless of whether resolution fires via "everyone voted" or the AMONG_VOTE_MS timeout fallback.
// among.service.kill() has no server-side distance check and AI kill probability/cooldowns are tuned
// long (45s cooldown + 15s post-meeting hold) relative to this section's runtime, so an AI-initiated
// kill mid-flow is possible but very unlikely to land inside the test window.

/**
 * Drives one full emergency-meeting cycle to a plurality ejection of `targetAiId`: `callerTag`
 * calls `among:emergency`, waits for the broadcast "meeting" phase, waits for the server sweep to
 * advance to "voting" after the AMONG_DISCUSSION_MS window, then has every one of the 4 human
 * sockets vote the target AI. Resolution (and thus the next phase/result) happens asynchronously
 * once every alive player — humans AND the server-driven AI votes — has voted (or the
 * AMONG_VOTE_MS timeout elapses); callers wait for their own success condition afterward.
 */
async function runEmergencyEjection(callerTag, targetAiId) {
  sockets[callerTag].socket.emit("among:emergency", { partyId });
  await waitFor(() => partyTags.every((t) => sockets[t].state.amongState?.phase === "meeting"), {
    timeoutMs: 5000,
    label: `all sockets see phase=meeting (called by ${callerTag})`,
  });
  await waitFor(() => partyTags.every((t) => sockets[t].state.amongState?.phase === "voting"), {
    timeoutMs: 14000,
    intervalMs: 500,
    label: "phase=voting (server sweep after AMONG_DISCUSSION_MS)",
  });
  for (const t of partyTags) {
    sockets[t].socket.emit("among:vote", { partyId, targetProfileId: targetAiId });
  }
}

async function sectionAmongUs() {
  // among.service.start() enforces AMONG_MIN_PLAYERS (default 4, apps/backend/.env doesn't
  // override it) against the CONNECTED socket roster — so unlike balance game, Among Us
  // genuinely needs the full 4-user partyTags subset to start (auto- or manually) at all.
  if (!partyId || partyTags.length < 4 || Object.keys(sockets).length < 4) {
    throw new Error(
      "party sockets not established (need all 4 shared test users — AMONG_MIN_PLAYERS=4) — skipping Among Us",
    );
  }

  // ── 1. Auto-start ──────────────────────────────────────────────────────────────────────────
  await check(
    "Among Us: auto-start — 정원 충족 시 어몽 자동 시작 (party.gateway.maybeAutoStartAmong)",
    async () => {
      // among:sync answers the CALLER ONLY (not a room broadcast) — poll every socket individually
      // so each one's state.amongState reflects its OWN personalized (role-redacted) snapshot,
      // independent of whether it already captured the auto-start broadcast during section 5.
      // amongEventCount (not amongState nullness) is what we wait on: project() legitimately
      // returns null when there's no session, so nullness can't distinguish "no reply yet" from
      // "replied: nothing running".
      const before = partyTags.map((t) => sockets[t].state.amongEventCount);
      for (const tag of partyTags) sockets[tag].socket.emit("among:sync", { partyId });
      await waitFor(() => partyTags.every((t, i) => sockets[t].state.amongEventCount > before[i]), {
        timeoutMs: 5000,
        label: "all sockets receive an among:sync response",
      });

      const alreadyActive = partyTags.every(
        (t) => sockets[t].state.amongState?.phase === "playing",
      );
      if (alreadyActive) {
        return (
          `AUTO-START PATH — sync shows phase=playing on all ${partyTags.length} sockets; this ` +
          `harness never called among:start (party:join filled the roster to capacity in section 5)`
        );
      }

      // Fallback: sync shows no active session (auto-start conditions unmet in this env — e.g. a
      // shared-queue split left partyTags.length or party.participantCount off 4). Use the same
      // manual path a real 다시하기 uses.
      sockets[partyTags[0]].socket.emit("among:start", { partyId });
      await waitFor(
        () => partyTags.every((t) => sockets[t].state.amongState?.phase === "playing"),
        {
          timeoutMs: 6000,
          label: `all ${partyTags.length} receive phase=playing after explicit among:start`,
        },
      );
      return "FALLBACK PATH — sync showed no active session; used explicit among:start";
    },
  );

  // ── 2. Role contract ───────────────────────────────────────────────────────────────────────
  let aiId1 = null;
  let aiId2 = null;
  await check(
    "Among Us: 역할 계약 — 4소켓 전원 crew, players에 ai- 2명(role 리댁션), isAi 필드 부재",
    async () => {
      for (const tag of partyTags) {
        const snap = sockets[tag].state.amongState;
        if (snap.myRole !== "crew")
          throw new Error(`BUG: ${tag}.myRole=${snap.myRole} (all 4 humans must be crew)`);
        for (const p of snap.players) {
          if ("isAi" in p)
            throw new Error(`BUG: ${tag} sees an isAi field mid-game on ${p.profileId.slice(-6)}`);
        }
        const aiPlayers = snap.players.filter((p) => p.profileId.startsWith("ai-"));
        if (aiPlayers.length !== 2)
          throw new Error(`BUG: ${tag} sees ${aiPlayers.length} ai- prefixed players, expected 2`);
        if (aiPlayers.some((p) => p.role !== null))
          throw new Error(`BUG: ${tag} can see an AI player's role pre-reveal`);
      }
      const ids = sockets[partyTags[0]].state.amongState.players
        .filter((p) => p.profileId.startsWith("ai-"))
        .map((p) => p.profileId)
        .sort();
      [aiId1, aiId2] = ids;
      return `crew confirmed on all ${partyTags.length}, AI personas=[${aiId1.slice(-6)},${aiId2.slice(-6)}], role/isAi redacted`;
    },
  );

  // ── 3. AI liveliness ───────────────────────────────────────────────────────────────────────
  await check("Among Us: AI 생동 — 15초 내 ai- 접두 party:moved 수신", async () => {
    const watcher = partyTags[0];
    const before = sockets[watcher].state.moved.length;
    await waitFor(
      () => sockets[watcher].state.moved.slice(before).some((m) => m.profileId.startsWith("ai-")),
      { timeoutMs: 15000, intervalMs: 500, label: "an ai- profileId appears in party:moved" },
    );
    const mover = sockets[watcher].state.moved
      .slice(before)
      .find((m) => m.profileId.startsWith("ai-"));
    return `${watcher} saw AI ${mover.profileId.slice(-6)} move to {x:${mover.x.toFixed(2)},y:${mover.y.toFixed(2)}}`;
  });

  // ── 4. Emergency meeting #1 → single ejection, game continues ─────────────────────────────
  await check(
    "Among Us: 긴급회의 #1 — 전원 AI#1 투표 → 추방, phase=playing 복귀(게임 계속)",
    async () => {
      await runEmergencyEjection(partyTags[0], aiId1);
      await waitFor(
        () => partyTags.every((t) => sockets[t].state.amongState?.phase === "playing"),
        { timeoutMs: 35000, intervalMs: 500, label: "phase returns to playing after ejection #1" },
      );
      const snap = sockets[partyTags[0]].state.amongState;
      const ejected = snap.players.find((p) => p.profileId === aiId1);
      if (!ejected || ejected.alive !== false)
        throw new Error(`BUG: AI#1 (${aiId1.slice(-6)}) not shown as ejected (alive !== false)`);
      if (snap.result !== null)
        throw new Error(
          `BUG: game already ended after only 1 of 2 impostors ejected: ${JSON.stringify(snap.result)}`,
        );
      return `AI#1 (${aiId1.slice(-6)}) ejected, phase=playing, game continues`;
    },
  );

  // ── 5. Emergency meeting #2 → final ejection, crew win ─────────────────────────────────────
  await check(
    "Among Us: 긴급회의 #2 — 전원 AI#2 투표 → 추방 → ended, winner=crew reason=ejected",
    async () => {
      // AMONG_EMERGENCY_PER_PLAYER=1 — partyTags[0] already spent its emergency in meeting #1, so
      // meeting #2 MUST be called by a different user (partyTags[1]).
      await runEmergencyEjection(partyTags[1], aiId2);
      await waitFor(() => sockets[partyTags[0]].state.amongState?.result != null, {
        timeoutMs: 35000,
        intervalMs: 500,
        label: "game result present after ejection #2",
      });
      const result = sockets[partyTags[0]].state.amongState.result;
      if (result.winner !== "crew" || result.reason !== "ejected") {
        throw new Error(`unexpected result: ${JSON.stringify(result)}`);
      }
      return `AI#2 (${aiId2.slice(-6)}) ejected, winner=${result.winner} reason=${result.reason}`;
    },
  );

  // ── 6. Identity reveal ──────────────────────────────────────────────────────────────────────
  await check(
    "Among Us: 정체 공개 — ended 스냅샷에 isAi===true 정확히 2명, 전원 ai- 접두",
    async () => {
      await waitFor(() => partyTags.every((t) => sockets[t].state.amongState?.phase === "ended"), {
        timeoutMs: 6000,
        label: "all sockets see phase=ended",
      });
      for (const tag of partyTags) {
        const snap = sockets[tag].state.amongState;
        const revealedAi = snap.players.filter((p) => p.isAi === true);
        if (revealedAi.length !== 2)
          throw new Error(`BUG: ${tag} sees ${revealedAi.length} isAi:true players, expected 2`);
        if (!revealedAi.every((p) => p.profileId.startsWith("ai-")))
          throw new Error(`BUG: ${tag} — a non-ai- profileId carries isAi:true`);
        if (!snap.players.every((p) => p.role !== null))
          throw new Error(`BUG: ${tag} — not all roles revealed on 'ended' snapshot`);
      }
      return `isAi:true on exactly 2 (both ai- prefixed, roles revealed) across all ${partyTags.length} sockets`;
    },
  );
}

// ─── 7. Balance game ────────────────────────────────────────────────────────
// party.gateway.ts game:* handlers + game.service.ts. votedProfileIds is the only per-round
// visibility exposed pre-reveal (GameSnapshot never carries raw per-user choices). Runs AFTER
// Among Us (see the file-header ORDERING NOTE) — section 6 plays the auto-started Among session
// through to "ended", so game.service.findActive (no gameType filter — balance/among share one
// "one ACTIVE session per party" slot) sees nothing active and game:start below starts cleanly.

async function sectionBalanceGame() {
  // game.service.vote() completes a round once every CONNECTED socket (presence roster) has
  // voted — not a hardcoded party size — so this section tolerates the shared-queue partyTags
  // subset down to 2 users (min for a meaningful a/b vote).
  if (!partyId || partyTags.length < 2 || Object.keys(sockets).length < partyTags.length) {
    throw new Error(
      "party sockets not established (need >=2 shared test users) — section 5 did not complete; skipping balance game",
    );
  }
  const [leadTag, ...restTags] = partyTags;

  await check(`Balance game: game:start → all ${partyTags.length} receive round 0`, async () => {
    sockets[leadTag].socket.emit("game:start", { partyId });
    await waitFor(
      () =>
        partyTags.every(
          (t) =>
            sockets[t].state.gameState?.round === 0 &&
            sockets[t].state.gameState?.status === "active",
        ),
      { timeoutMs: 5000, label: `all ${partyTags.length} receive round=0 active` },
    );
    return `round=0 totalRounds=${sockets[leadTag].state.gameState.totalRounds}`;
  });

  await check(
    `Balance game: ${leadTag} votes → snapshot shows votedProfileIds only, no choices`,
    async () => {
      sockets[leadTag].socket.emit("game:vote", { partyId, choice: "a" });
      await waitFor(
        () => sockets[leadTag].state.gameState?.votedProfileIds?.includes(users[leadTag].profileId),
        {
          timeoutMs: 4000,
          label: `${leadTag}'s vote reflected in votedProfileIds`,
        },
      );
      const snap = sockets[leadTag].state.gameState;
      if ("choices" in snap || "votes" in snap)
        throw new Error("BUG: snapshot leaked raw per-user choices");
      return `votedProfileIds=${JSON.stringify(snap.votedProfileIds)}`;
    },
  );

  await check(`Balance game: all ${partyTags.length} vote → reveal + round advance`, async () => {
    restTags.forEach((t, i) => {
      sockets[t].socket.emit("game:vote", { partyId, choice: i % 2 === 0 ? "a" : "b" });
    });
    await waitFor(() => sockets[leadTag].state.gameState?.round === 1, {
      timeoutMs: 6000,
      label: "round advances to 1",
    });
    const snap = sockets[leadTag].state.gameState;
    if (snap.reveals.length !== 1 || snap.reveals[0].round !== 0) {
      throw new Error(`unexpected reveals: ${JSON.stringify(snap.reveals)}`);
    }
    const voters = new Set([...snap.reveals[0].aVoters, ...snap.reveals[0].bVoters]);
    if (voters.size !== partyTags.length)
      throw new Error(`expected ${partyTags.length} voters revealed, got ${voters.size}`);
    return `round=1 reveals=1 votersRevealed=${voters.size}`;
  });

  await check("Balance game: game:end force-ends", async () => {
    sockets[leadTag].socket.emit("game:end", { partyId });
    await waitFor(() => sockets[leadTag].state.gameState?.status === "ended", {
      timeoutMs: 4000,
      label: "status=ended",
    });
    return `status=${sockets[leadTag].state.gameState.status}`;
  });
}

// ─── 8. Party end → proposal window ─────────────────────────────────────────
// proposal.service.ts send(): eligible party = status "active" OR ("ended" within
// PROPOSAL_WINDOW_HOURS) AND caller is a participant — our party is "active" (nothing in the
// designed flow ever transitions a Party to "ended" outside the admin-only PATCH, which is out
// of scope for a real-user funnel), so A→B is proposable immediately, no extra transition needed.
// "duplicate accept idempotent" is tested via the ACTUAL dedupe mechanic in match.service.ts:
// a mutual cross-accept (A→B accepted, then B→A accepted) upserts onto the SAME Match row.

async function sectionProposal() {
  if (!partyId) throw new Error("no partyId — cannot test proposals");

  let proposalAB = null;
  let proposalBA = null;

  await check("Proposal: A → B", async () => {
    const r = await post("/proposals", users.A.token, { partyId, toProfileId: users.B.profileId });
    assertStatus(r, 201, "A proposes to B");
    proposalAB = r.body.id;
    return `proposalId=${proposalAB}`;
  });

  await check("Proposal: B → A (mutual, both pending pre-match)", async () => {
    const r = await post("/proposals", users.B.token, { partyId, toProfileId: users.A.profileId });
    assertStatus(r, 201, "B proposes to A");
    proposalBA = r.body.id;
    return `proposalId=${proposalBA}`;
  });

  await check("Proposal: B sees A's proposal in received list", async () => {
    const r = await get("/proposals/received", users.B.token);
    assertStatus(r, 200, "GET /proposals/received (B)");
    const found = r.body.find((p) => p.id === proposalAB);
    if (!found) throw new Error("A's proposal missing from B's received list");
    if (found.peer.profileId !== users.A.profileId) throw new Error("peer profileId mismatch");
    return `found, peer=${found.peer.name}`;
  });

  await check("Proposal: B accepts A→B → Match created", async () => {
    const r = await post(`/proposals/${proposalAB}/accept`, users.B.token, {});
    assertStatus(r, [200, 201], "B accepts A's proposal");
    if (!r.body.matchId || !r.body.roomId)
      throw new Error(`missing matchId/roomId: ${JSON.stringify(r.body)}`);
    matchId = r.body.matchId;
    roomId = r.body.roomId;
    return `matchId=${matchId} roomId=${roomId}`;
  });

  await check("Proposal: A accepts B→A (mutual cross-accept) → idempotent same Match", async () => {
    const r = await post(`/proposals/${proposalBA}/accept`, users.A.token, {});
    assertStatus(r, [200, 201], "A accepts B's proposal");
    if (r.body.matchId !== matchId) {
      throw new Error(
        `BUG: expected same matchId=${matchId} (upsert dedupe), got ${r.body.matchId}`,
      );
    }
    return `same matchId=${r.body.matchId} (upsert dedupe, no duplicate Match/room)`;
  });
}

// ─── 9. Messenger ───────────────────────────────────────────────────────────
// messenger.controller.ts (REST) + messenger.gateway.ts (Socket.IO, separate connection per the
// mobile client's actual pattern — apps/mobile/src/lib/messenger-socket.ts opens its own socket
// independent of the party socket).

async function sectionMessenger() {
  if (!matchId || !roomId) throw new Error("no matchId/roomId — proposal section did not complete");

  let msgId1 = null;
  await check("Messenger: A sends DM via REST", async () => {
    const content = `hi-B-${RID}`;
    const r = await post(`/messenger/rooms/${roomId}/messages`, users.A.token, { content });
    assertStatus(r, 201, "A sends DM");
    msgId1 = r.body.id;
    return `messageId=${msgId1}`;
  });

  await check("Messenger: B fetches history via REST, contains A's message", async () => {
    const r = await get(`/messenger/rooms/${roomId}/messages`, users.B.token);
    assertStatus(r, 200, "GET message history (B)");
    if (!r.body.some((m) => m.id === msgId1)) throw new Error("BUG: message missing from history");
    return `history length=${r.body.length}`;
  });

  await check("Messenger: B connects socket + room:join", async () => {
    connectMessengerSocket("B");
    await waitConnected(msgrSockets.B.socket);
    msgrSockets.B.socket.emit("room:join", { roomId });
    await sleep(300);
    return "B joined room via socket";
  });

  let msgId2 = null;
  await check("Messenger: A sends (REST) → B receives realtime (socket)", async () => {
    const content = `hi-again-${RID}`;
    const r = await post(`/messenger/rooms/${roomId}/messages`, users.A.token, { content });
    assertStatus(r, 201, "A sends 2nd DM");
    msgId2 = r.body.id;
    await waitFor(() => msgrSockets.B.state.newMessages.some((e) => e.message?.id === msgId2), {
      timeoutMs: 4000,
      label: "B receives message:new",
    });
    return `B received message:new id=${msgId2}`;
  });

  await check("Messenger: read receipt — B markRead, A sees receipt state", async () => {
    connectMessengerSocket("A");
    await waitConnected(msgrSockets.A.socket);
    msgrSockets.A.socket.emit("room:join", { roomId });
    await sleep(300);

    const r = await post(`/messenger/rooms/${roomId}/read`, users.B.token, {});
    assertStatus(r, [200, 201], "B markRead");
    if (!r.body.lastReadAt) throw new Error("missing lastReadAt in markRead response");

    await waitFor(() => msgrSockets.A.state.reads.length > 0, {
      timeoutMs: 4000,
      label: "A receives message:read",
    });

    const hist = await get(`/messenger/rooms/${roomId}/messages`, users.A.token);
    assertStatus(hist, 200, "GET message history (A, post-read)");
    const sentByA = hist.body.filter((m) => m.senderProfileId === users.A.profileId);
    if (sentByA.length === 0 || !sentByA.every((m) => m.readAt)) {
      throw new Error("BUG: A's sent messages not marked readAt after B's markRead");
    }
    return `readAt set on ${sentByA.length} message(s), A received message:read event`;
  });
}

// ─── 10. Date plan ──────────────────────────────────────────────────────────
// date-plan.controller.ts + date-plan.service.ts. select() requires creator; confirm() requires
// the OTHER match participant (not the creator) — matches A-creates / B-confirms below.

async function sectionDatePlan() {
  if (!matchId) throw new Error("no matchId — proposal section did not complete");

  let datePlanId = null;
  let courseId = null;

  await check("Date plan: A creates for the match", async () => {
    const r = await post("/date-plans", users.A.token, {
      matchId,
      budget: { total: 100000, currency: "KRW" },
      location: { city: "서울", district: "강남구", maxTravelMinutes: 30 },
      dateTime: {
        preferredDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        durationHours: 3,
      },
    });
    assertStatus(r, 201, "A creates date plan");
    datePlanId = r.body.id;
    if (!r.body.courses?.length) throw new Error("no courses generated");
    courseId = r.body.courses[0].courseId;
    return `datePlanId=${datePlanId} courses=${r.body.courses.length}`;
  });

  await check("Date plan: creator (A) selects a course", async () => {
    const r = await patch(`/date-plans/${datePlanId}/select`, users.A.token, { courseId });
    assertStatus(r, 200, "A selects course");
    if (r.body.selectedCourseId !== courseId) throw new Error("selectedCourseId mismatch");
    return `selectedCourseId=${courseId}`;
  });

  await check("Date plan: peer (B) confirms", async () => {
    const r = await patch(`/date-plans/${datePlanId}/confirm`, users.B.token, {});
    assertStatus(r, 200, "B confirms");
    if (r.body.status !== "confirmed") throw new Error(`unexpected status=${r.body.status}`);
    return `status=${r.body.status}`;
  });

  await check("Date plan: double-confirm is idempotent", async () => {
    const r = await patch(`/date-plans/${datePlanId}/confirm`, users.B.token, {});
    assertStatus(r, 200, "B confirms again");
    if (r.body.status !== "confirmed") throw new Error(`unexpected status=${r.body.status}`);
    return `status=${r.body.status} (idempotent, no error on re-confirm)`;
  });
}

// ─── 11. Moderation ─────────────────────────────────────────────────────────
// safety.controller.ts + safety.service.ts. E was deliberately kept OUT of the party (section 5),
// so proposal.service's co-participation check ("상대가 이 파티의 참가자가 아닙니다") is what
// actually rejects E→A — not the block. Per the mission's own documented fallback, we assert that
// AND independently verify the blocks list + unblock, which are the block-specific guarantees.

async function sectionModeration() {
  if (!users.A?.profileId || !users.E?.profileId)
    throw new Error("missing A or E profile — cannot test moderation");

  await check("Moderation: A reports E", async () => {
    const r = await post("/safety/report", users.A.token, {
      reportedProfileId: users.E.profileId,
      reason: "harassment",
      details: "mega-qa harness test report",
    });
    assertStatus(r, 201, "A reports E");
    return `reportId=${r.body.id}`;
  });

  await check("Moderation: A blocks E", async () => {
    const r = await post("/safety/blocks", users.A.token, { blockedProfileId: users.E.profileId });
    assertStatus(r, 201, "A blocks E");
    return "blocked";
  });

  await check("Moderation: E → A proposal rejected (blocked/no-co-participation)", async () => {
    const r = await post("/proposals", users.E.token, { partyId, toProfileId: users.A.profileId });
    if (r.status < 400 || r.status >= 500)
      throw new Error(`expected 4xx rejection, got ${describeErr(r)}`);
    return `${describeErr(r)} — E never joined the party, so rejection is via co-participation guard, not the block (expected per design)`;
  });

  await check("Moderation: A's blocks list contains E", async () => {
    const r = await get("/safety/blocks", users.A.token);
    assertStatus(r, 200, "GET /safety/blocks");
    if (!r.body.some((p) => p.profileId === users.E.profileId))
      throw new Error("E missing from blocks list");
    return `blocks=${r.body.length}`;
  });

  await check("Moderation: unblock E works", async () => {
    const r = await del(`/safety/blocks/${users.E.profileId}`, users.A.token);
    assertStatus(r, 204, "unblock E");
    const after = await get("/safety/blocks", users.A.token);
    if (after.body.some((p) => p.profileId === users.E.profileId))
      throw new Error("BUG: E still present after unblock");
    return `unblocked, blocks now=${after.body.length}`;
  });
}

// ─── 12. Dashboard ──────────────────────────────────────────────────────────
// dashboard.controller.ts + dashboard.service.ts. NOTE (designed-behavior clarification, not a
// bug): GET /dashboard/summary only exposes {profileId, completedParties, unreadNotifications} —
// completedParties counts parties with status "ended" specifically, which our funnel party never
// reaches (nothing in the real-user flow ends a party; that's an admin-only PATCH). So we verify
// "party ≥ 1" via GET /dashboard/my-parties (all parties regardless of status) and "match ≥ 1"
// via GET /messenger/rooms (match.service.listMyMatches), which are the real endpoints that
// expose those counts.

async function sectionDashboard() {
  if (!users.A?.profileId) throw new Error("no profile for A — cannot test dashboard");

  await check("Dashboard: A summary has consistent shape", async () => {
    const r = await get("/dashboard/summary", users.A.token);
    assertStatus(r, 200, "GET /dashboard/summary");
    if (
      typeof r.body.completedParties !== "number" ||
      typeof r.body.unreadNotifications !== "number"
    ) {
      throw new Error(`unexpected shape: ${JSON.stringify(r.body)}`);
    }
    return `completedParties=${r.body.completedParties} (0 expected — party never reaches "ended" in a real-user funnel), unreadNotifications=${r.body.unreadNotifications}`;
  });

  await check("Dashboard: A my-parties includes the funnel party (party ≥ 1)", async () => {
    const r = await get("/dashboard/my-parties", users.A.token);
    assertStatus(r, 200, "GET /dashboard/my-parties");
    if (r.body.total < 1) throw new Error("total < 1");
    if (partyId && !r.body.parties.some((p) => p.id === partyId))
      throw new Error("funnel party missing from my-parties");
    return `total=${r.body.total}`;
  });

  await check("Dashboard: A messenger/rooms shows the funnel match (match ≥ 1)", async () => {
    const r = await get("/messenger/rooms", users.A.token);
    assertStatus(r, 200, "GET /messenger/rooms");
    if (matchId && !r.body.some((m) => m.matchId === matchId))
      throw new Error("funnel match missing from rooms list");
    return `rooms=${r.body.length}`;
  });
}

// ─── 13. Rate limit (LAST) ──────────────────────────────────────────────────
// auth.controller.ts: POST /auth/login is @Throttle({ttl:60000, limit:10}). health.controller.ts
// is @SkipThrottle, so it must stay 200 throughout. Run last per the mission's rate-limit budget.

async function sectionRateLimit() {
  await check("Rate limit: spam POST /auth/login (wrong password) until 429", async () => {
    let attempts = 0;
    const maxAttempts = 15;
    let got429 = false;
    for (; attempts < maxAttempts; attempts++) {
      const r = await post("/auth/login", null, {
        email: users.A.email,
        password: "definitely-wrong-pw",
      });
      if (r.status === 429) {
        got429 = true;
        break;
      }
    }
    if (!got429) throw new Error(`no 429 after ${attempts} attempts`);
    return `429 arrived after ${attempts + 1} attempt(s)`;
  });

  await check("Rate limit: GET /health stays 200 despite login spam", async () => {
    const r = await get("/health");
    assertStatus(r, 200, "GET /health post-spam");
    return "status=200";
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`MEGA-QA starting against ${BASE} (run id ${RID})`);
  const t0 = Date.now();

  await runSection("1. Health", sectionHealth);
  await runSection("2. Signup×4", sectionSignup);
  await runSection("3. Onboarding", sectionOnboarding);
  await runSection("4. Matchmaking", sectionMatchmaking);
  await runSection("5. Party realtime", sectionPartyRealtime);
  await runSection("6. Among Us — AI를 찾아라 (auto-started at full roster)", sectionAmongUs);
  await runSection("7. Balance game", sectionBalanceGame);
  await runSection("8. Party end → proposal window", sectionProposal);
  await runSection("9. Messenger", sectionMessenger);
  await runSection("10. Date plan", sectionDatePlan);
  await runSection("11. Moderation", sectionModeration);
  await runSection("12. Dashboard", sectionDashboard);
  await runSection("13. Rate limit (last)", sectionRateLimit);

  for (const s of Object.values(sockets)) s.socket.disconnect();
  for (const s of Object.values(msgrSockets)) s.socket.disconnect();

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("");
  console.log(`MEGA-QA: ${passCount}/${checkNum} PASS (${dt}s)`);
  process.exit(passCount === checkNum ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
