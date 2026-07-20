#!/usr/bin/env node
/**
 * seed-demo.mjs — Demo-data seeder + live bot host for MingleAI v2.
 *
 * Logs in as an ALREADY-ONBOARDED human account, spins up 3 Korean bot profiles with
 * preferences matching the human's (so matchmaking groups everyone into one party),
 * gets all 4 matched, then keeps the 3 bots' party sockets alive for the rest of the
 * process so a human operator can walk through every feature live in the mobile/web UI:
 * party chat/move, Among Us (AUTO-STARTED the instant the human's socket becomes the 4th
 * party:join — see the checklist note in printChecklist()), balance game, proposals,
 * messenger, date plans, moderation.
 *
 * It also pre-seeds the relationship funnel via REST (proposal → accept → match → DM →
 * date plan) so the 채팅/알림/프로포즈 tabs are populated the moment the human opens the app.
 *
 * Contract references (endpoints/payloads reused verbatim, not guessed):
 *   - tools/mega-qa.mjs   — full REST+socket funnel (auth, profiles, matchmaking, party
 *     gateway, game:*, among:*, proposals, messenger, date-plans, safety).
 *   - tools/among-bots.mjs — party-space normalized-coordinate conventions (ROOM_MARGIN,
 *     MOVE_SPEED, spawnFor/clampToRoom/stepToward) and the among:state bot-player pattern.
 *
 * Usage:
 *   node tools/seed-demo.mjs <humanEmail> <humanPassword>
 *   SEED_DEMO_API=http://localhost:3000 node tools/seed-demo.mjs <humanEmail> <humanPassword>
 *
 * Zero new deps: global fetch + socket.io-client (already installed in the monorepo root).
 * Ctrl-C (SIGINT) disconnects all bot sockets cleanly and exits.
 */

import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SIO_PATH = path.join(REPO_ROOT, "node_modules/socket.io-client/build/esm/index.js");
const { io: socketIo } = await import(SIO_PATH);

// ─── Config ─────────────────────────────────────────────────────────────────

const BASE = process.env.SEED_DEMO_API ?? "http://localhost:3000";
const RID = Date.now().toString(36);
const BOT_PASSWORD = "SeedDemo123!pw";

const [, , humanEmail, humanPassword] = process.argv;
if (!humanEmail || !humanPassword) {
  console.error("Usage: node tools/seed-demo.mjs <humanEmail> <humanPassword>");
  process.exit(1);
}

// ─── Tiny utilities ─────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(tag, ...args) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] [${tag}]`, ...args);
}

function describeErr(r) {
  return `${r.status}: ${typeof r.body === "string" ? r.body : JSON.stringify(r.body)}`;
}

function ok(r) {
  return r.status === 200 || r.status === 201;
}

let warned429 = false;
function checkAuth429(r, label) {
  if (r.status === 429 && !warned429) {
    warned429 = true;
    console.warn(
      `\n⚠ 429 Too Many Requests on ${label} — auth rate limit hit (10/min/IP). ` +
        `Wait 60s and re-run seed-demo.mjs.\n`,
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

// ─── Party-space conventions (copied from tools/among-bots.mjs, which mirrors
// apps/mobile/src/lib/party-space.ts — keep values identical to PartyRoomCanvas). ─────────

const ROOM_MARGIN = 0.06;
const MOVE_SPEED = 0.35; // normalized units/sec
const TASK_RANGE = 0.1;

function clampToRoom(p) {
  const clamp = (v) => Math.min(Math.max(v, ROOM_MARGIN), 1 - ROOM_MARGIN);
  return { x: clamp(p.x), y: clamp(p.y) };
}

function stepToward(current, target, dtMs) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.hypot(dx, dy);
  const step = MOVE_SPEED * (dtMs / 1000);
  if (dist === 0 || dist <= step) return { x: target.x, y: target.y };
  return { x: current.x + (dx / dist) * step, y: current.y + (dy / dist) * step };
}

function spawnFor(profileId) {
  let h = 5381;
  for (let i = 0; i < profileId.length; i++) {
    h = ((h << 5) + h + profileId.charCodeAt(i)) >>> 0;
  }
  const gx = (h % 1000) / 1000;
  const gy = (Math.floor(h / 1000) % 1000) / 1000;
  return clampToRoom({ x: 0.15 + gx * 0.7, y: 0.15 + gy * 0.7 });
}

function dist2(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pickWanderTarget() {
  return clampToRoom({ x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8 });
}

// ─── Shared state ───────────────────────────────────────────────────────────

const human = { email: humanEmail, password: humanPassword };
const BOT_SEEDS = [
  { tag: "seoyeon", name: "서연", age: 27, gender: "female", occupation: "마케터" },
  { tag: "doyoon", name: "도윤", age: 29, gender: "male", occupation: "개발자" },
  { tag: "haeun", name: "하은", age: 26, gender: "female", occupation: "간호사" },
];
const bots = []; // { tag, name, email, token, profileId, socket, pos, ... }
const positions = new Map(); // profileId -> {x,y}, merged from all party:moved broadcasts
let partyId = null;
let partyTags = []; // subset of bot tags that actually share the human's party
const timers = new Set(); // all setTimeout/setInterval handles, cleared on SIGINT
const seedSummary = { bots: [], match: null, dms: 0, datePlan: null, doyoonProposal: null };

function track(handle) {
  timers.add(handle);
  return handle;
}

// ─── Step 1: human login + profile check ───────────────────────────────────

async function loginHuman() {
  const r = await post("/auth/login", null, { email: human.email, password: human.password });
  checkAuth429(r, "POST /auth/login (human)");
  if (!ok(r) || !r.body?.accessToken) {
    console.error(`FATAL: human login failed — ${describeErr(r)}`);
    console.error("Make sure the account exists (register it in the app first).");
    process.exit(1);
  }
  human.token = r.body.accessToken;

  const prof = await get("/profiles/me", human.token);
  if (!ok(prof) || !prof.body?.id) {
    console.error(
      `FATAL: human account ${human.email} has no profile yet. ` +
        "Complete onboarding (create a profile) in the app, then re-run this seeder.",
    );
    process.exit(1);
  }
  human.profileId = prof.body.id;
  human.name = prof.body.name ?? "human";
  human.partyPreferenceText =
    prof.body.partyPreferenceText ??
    "가볍게 어울리면서 다양한 미니게임과 대화를 즐기는 밝고 활발한 분위기를 좋아해요";
  log("setup", `human logged in: ${human.name} (${human.profileId})`);
}

// ─── Step 2: create 3 bot accounts + profiles ──────────────────────────────

async function createBot(seed) {
  const em = `seed_${RID}_${seed.tag}@demo.test`;
  const reg = await post("/auth/register", null, { email: em, password: BOT_PASSWORD });
  checkAuth429(reg, `POST /auth/register (${seed.name})`);
  if (!ok(reg) || !reg.body?.accessToken) {
    throw new Error(`register failed: ${describeErr(reg)}`);
  }
  const token = reg.body.accessToken;

  const prof = await post("/profiles", token, {
    name: seed.name,
    age: seed.age,
    gender: seed.gender,
    occupation: seed.occupation,
    partyPreferenceText: human.partyPreferenceText,
  });
  if (!ok(prof) || !prof.body?.id) {
    throw new Error(`profile create failed: ${describeErr(prof)}`);
  }

  const bot = {
    tag: seed.tag,
    name: seed.name,
    email: em,
    token,
    profileId: prof.body.id,
    pos: null,
    wanderTarget: null,
    greeted: false,
    lastReplyAt: 0,
    votedRounds: new Set(),
    lastGameStatus: null,
    gameState: null,
    amongState: null,
    lastSessionId: undefined,
    lastTaskAt: 0,
    doneTaskIds: new Set(),
    votedThisMeeting: false,
  };
  bot.pos = spawnFor(bot.profileId);
  bot.wanderTarget = pickWanderTarget();
  bots.push(bot);
  log("setup", `bot created: ${seed.name} (${bot.profileId}) email=${em}`);
  return bot;
}

async function createAllBots() {
  for (const seed of BOT_SEEDS) {
    try {
      const bot = await createBot(seed);
      seedSummary.bots.push(`${bot.name} (${bot.profileId})`);
    } catch (e) {
      log("setup", `ERROR creating bot ${seed.name}: ${e.message} — continuing without it`);
    }
  }
  if (bots.length === 0) {
    console.error("FATAL: no bots could be created — nothing to seed or host. Exiting.");
    process.exit(1);
  }
}

// ─── Step 3: matchmaking — human + bots into one party ─────────────────────

async function enqueueWithCongestionRetry(token, label, { retries = 3, backoffMs = 400 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await post("/matchmaking/queue", token, {});
    if (ok(last) || last.status === 409) return last;
    if (attempt < retries) {
      await sleep(backoffMs);
      continue;
    }
    log("matchmaking", `WARN: enqueue ${label} failed: ${describeErr(last)}`);
    return last;
  }
  return last;
}

async function pollMatched(token, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await get("/matchmaking/status", token);
    if (r.status === 200 && r.body?.status === "matched" && r.body.matchedPartyId) {
      return r.body.matchedPartyId;
    }
    if (Date.now() >= deadline) return null;
    await sleep(2000);
  }
}

async function formParty() {
  log("matchmaking", "enqueueing human + bots...");
  await Promise.all([
    enqueueWithCongestionRetry(human.token, "human"),
    ...bots.map((b) => enqueueWithCongestionRetry(b.token, b.name)),
  ]);

  log("matchmaking", "polling for a shared party (up to 90s)...");
  const [humanPartyId, ...botPartyIds] = await Promise.all([
    pollMatched(human.token, 90000),
    ...bots.map((b) => pollMatched(b.token, 90000)),
  ]);

  if (!humanPartyId) {
    console.error(
      "FATAL: human never matched into a party. Matchmaking sweep may be stalled — " +
        "check the backend, then re-run.",
    );
    process.exit(1);
  }
  partyId = humanPartyId;

  partyTags = [];
  bots.forEach((b, i) => {
    if (botPartyIds[i] === partyId) partyTags.push(b.tag);
    else
      log(
        "matchmaking",
        `WARN: ${b.name} matched into a different party (${botPartyIds[i] ?? "none"}) — ` +
          "excluding from live hosting/seeding (shared-queue split, not a bug).",
      );
  });

  console.log(
    `\nPARTY FORMED: partyId=${partyId} (human + ${partyTags.length}/${bots.length} bots)\n`,
  );
}

// ─── Step 4: bot party sockets — presence, wander, chat, games ─────────────

function amBotProfileId(profileId) {
  return bots.some((b) => b.profileId === profileId);
}

function connectBotSocket(bot) {
  const socket = socketIo(BASE, {
    auth: { token: bot.token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
  });
  bot.socket = socket;

  socket.on("connect", () => {
    log(bot.tag, "connected → party:join");
    socket.emit("party:join", { partyId });
    if (!bot.greeted) {
      bot.greeted = true;
      track(
        setTimeout(() => {
          socket.emit("party:move", { partyId, x: bot.pos.x, y: bot.pos.y });
          positions.set(bot.profileId, bot.pos);
        }, 500),
      );
      track(
        setTimeout(
          () => {
            socket.emit("party:chat", { partyId, content: "안녕하세요~ 반가워요!" });
            log(bot.tag, "greeted the party");
          },
          1500 + Math.random() * 1500,
        ),
      );
    }
  });

  socket.on("party:presence", (d) => {
    bot.presence = d;
  });

  socket.on("party:moved", (d) => {
    if (d?.profileId) positions.set(d.profileId, { x: d.x, y: d.y });
  });

  socket.on("party:message", (m) => {
    // party message DTO field is `profileId` (party.service.ts toMessageView), not senderProfileId.
    if (!m || amBotProfileId(m.profileId)) return; // ignore our own bots' chatter
    const now = Date.now();
    if (now - bot.lastReplyAt < 20000) return;
    bot.lastReplyAt = now;
    track(
      setTimeout(
        () => {
          socket.emit("party:chat", { partyId, content: "ㅋㅋ 좋아요" });
          log(bot.tag, "replied to human chat");
        },
        400 + Math.random() * 800,
      ),
    );
  });

  socket.on("game:state", (d) => {
    const snap = d?.snapshot;
    if (!snap) return;
    const prevStatus = bot.lastGameStatus;
    bot.lastGameStatus = snap.status;
    if (snap.status === "active" && snap.round === 0 && prevStatus && prevStatus !== "active") {
      bot.votedRounds = new Set(); // fresh game restarted
    }
    bot.gameState = snap;
    if (
      snap.status === "active" &&
      !snap.votedProfileIds?.includes(bot.profileId) &&
      !bot.votedRounds.has(snap.round)
    ) {
      bot.votedRounds.add(snap.round);
      track(
        setTimeout(
          () => {
            const cur = bot.gameState;
            if (
              cur?.status === "active" &&
              cur.round === snap.round &&
              !cur.votedProfileIds?.includes(bot.profileId)
            ) {
              socket.emit("game:vote", { partyId, choice: Math.random() < 0.5 ? "a" : "b" });
              log(bot.tag, `voted balance game round=${snap.round}`);
            }
          },
          1500 + Math.random() * 1500,
        ),
      );
    }
  });

  socket.on("among:state", (d) => {
    const snap = d?.snapshot;
    if (!snap) return;
    const prevPhase = bot.amongState?.phase;
    const prevSession = bot.amongState?.sessionId;
    bot.amongState = snap;

    if (snap.sessionId !== prevSession) {
      bot.doneTaskIds = new Set();
      bot.votedThisMeeting = false;
      if (snap.myRole) log(bot.tag, `among role revealed: ${snap.myRole}`);
    }

    if (snap.phase === "voting" && prevPhase !== "voting") {
      bot.votedThisMeeting = false;
      track(
        setTimeout(
          () => {
            if (
              bot.socket?.connected &&
              bot.amongState?.phase === "voting" &&
              !bot.votedThisMeeting &&
              !bot.amongState?.result
            ) {
              bot.votedThisMeeting = true;
              socket.emit("among:vote", { partyId, targetProfileId: "skip" });
              log(bot.tag, "voted skip in meeting");
            }
          },
          5000 + Math.random() * 1000,
        ),
      );
    }
    if (snap.result && !bot.resultLogged) {
      bot.resultLogged = true;
      log(bot.tag, `among game ended: winner=${snap.result.winner} reason=${snap.result.reason}`);
    }
  });

  socket.on("party:error", (e) => log(bot.tag, "party:error", JSON.stringify(e)));
  socket.on("connect_error", (e) => log(bot.tag, "connect_error:", e.message));
  socket.on("disconnect", (reason) => log(bot.tag, "disconnected:", reason));

  return socket;
}

function scheduleWander(bot) {
  const delay = 4000 + Math.random() * 3000;
  bot.wanderTimer = track(
    setTimeout(() => {
      const busyWithAmong =
        bot.amongState &&
        !bot.amongState.result &&
        ["playing", "meeting", "voting"].includes(bot.amongState.phase);
      if (bot.socket?.connected && !busyWithAmong) {
        if (!bot.wanderTarget || dist2(bot.pos, bot.wanderTarget) < 0.05) {
          bot.wanderTarget = pickWanderTarget();
        }
        bot.pos = clampToRoom(stepToward(bot.pos, bot.wanderTarget, delay));
        positions.set(bot.profileId, bot.pos);
        bot.socket.emit("party:move", { partyId, x: bot.pos.x, y: bot.pos.y });
      }
      scheduleWander(bot);
    }, delay),
  );
}

// Among Us pacing tick (global, runs every 2s): every human bot plays crew and does
// one task every ~15s. The 2 AI impostor personas are driven entirely server-side
// (AiImpostorBrain sweep) — bots never kill.
function amongPacingTick() {
  for (const bot of bots) {
    if (!bot.socket?.connected || !partyTags.includes(bot.tag)) continue;
    const snap = bot.amongState;
    if (!snap || snap.phase !== "playing" || snap.result) continue;
    const me = snap.players?.find((p) => p.profileId === bot.profileId);
    if (!me?.alive) continue;
    const now = Date.now();

    if (now - bot.lastTaskAt < 15000) continue;
    const undone = (snap.myTasks ?? []).filter((t) => !t.done && !bot.doneTaskIds.has(t.taskId));
    if (!undone.length) continue;
    undone.sort((a, b) => dist2(bot.pos, a) - dist2(bot.pos, b));
    const target = undone[0];
    bot.pos = clampToRoom(stepToward(bot.pos, target, 2000));
    positions.set(bot.profileId, bot.pos);
    bot.socket.emit("party:move", { partyId, x: bot.pos.x, y: bot.pos.y });
    if (dist2(bot.pos, target) < TASK_RANGE) {
      bot.doneTaskIds.add(target.taskId);
      bot.lastTaskAt = now;
      bot.socket.emit("among:task", {
        partyId,
        taskId: target.taskId,
        x: target.x,
        y: target.y,
      });
      log(bot.tag, `task complete: ${target.taskId}`);
    }
  }
}

function startBotHosting() {
  for (const bot of bots) {
    if (!partyTags.includes(bot.tag)) continue;
    connectBotSocket(bot);
    scheduleWander(bot);
  }
  track(setInterval(amongPacingTick, 2000));
}

// ─── Step 5: seed the relationship funnel ──────────────────────────────────

async function seedSeoyeonFunnel() {
  const seoyeon = bots.find((b) => b.tag === "seoyeon" && partyTags.includes(b.tag));
  if (!seoyeon) {
    log(
      "seed",
      "WARN: 서연 unavailable (not created or not in party) — skipping match/DM/date-plan seed",
    );
    return;
  }
  try {
    const propR = await post("/proposals", seoyeon.token, {
      partyId,
      toProfileId: human.profileId,
    });
    if (!ok(propR)) throw new Error(`propose failed: ${describeErr(propR)}`);

    const acceptR = await post(`/proposals/${propR.body.id}/accept`, human.token, {});
    if (!ok(acceptR) || !acceptR.body?.matchId || !acceptR.body?.roomId) {
      throw new Error(`human auto-accept failed: ${describeErr(acceptR)}`);
    }
    const { matchId, roomId } = acceptR.body;
    seedSummary.match = { matchId, roomId, with: seoyeon.name };
    log("seed", `서연 ⇄ human matched → matchId=${matchId} roomId=${roomId}`);

    const dmTexts = [
      "어제 파티 재밌었어요!",
      "혹시 주말에 시간 되세요?",
      "카페 투어 좋아하신다면서요 ☕",
    ];
    for (const content of dmTexts) {
      const r = await post(`/messenger/rooms/${roomId}/messages`, seoyeon.token, { content });
      if (ok(r)) seedSummary.dms++;
      else log("seed", `WARN: DM send failed (${content}): ${describeErr(r)}`);
      await sleep(300); // keep createdAt ordering stable
    }
    log("seed", `서연 sent ${seedSummary.dms}/3 DMs`);

    const dpR = await post("/date-plans", seoyeon.token, {
      matchId,
      budget: { total: 100000, currency: "KRW" },
      location: { city: "서울", district: "강남구", maxTravelMinutes: 30 },
      dateTime: {
        preferredDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        durationHours: 3,
      },
    });
    if (!ok(dpR) || !dpR.body?.courses?.length) {
      log("seed", `WARN: date plan create failed: ${describeErr(dpR)}`);
      return;
    }
    const courseId = dpR.body.courses[0].courseId;
    const selR = await patch(`/date-plans/${dpR.body.id}/select`, seoyeon.token, { courseId });
    if (ok(selR)) {
      seedSummary.datePlan = { id: dpR.body.id, courseId };
      log(
        "seed",
        `date plan ${dpR.body.id}: 서연 selected course ${courseId} (awaiting human confirm)`,
      );
    } else {
      log("seed", `WARN: date plan select failed: ${describeErr(selR)}`);
    }
  } catch (e) {
    log("seed", `ERROR seeding 서연 funnel: ${e.message} — continuing`);
  }
}

async function seedDoyoonProposal() {
  const doyoon = bots.find((b) => b.tag === "doyoon" && partyTags.includes(b.tag));
  if (!doyoon) {
    log(
      "seed",
      "WARN: 도윤 unavailable (not created or not in party) — skipping pending proposal seed",
    );
    return;
  }
  try {
    const propR = await post("/proposals", doyoon.token, { partyId, toProfileId: human.profileId });
    if (!ok(propR)) throw new Error(`propose failed: ${describeErr(propR)}`);
    seedSummary.doyoonProposal = propR.body.id;
    log("seed", `도윤 → human proposal sent, left PENDING (id=${propR.body.id})`);
  } catch (e) {
    log("seed", `ERROR seeding 도윤 proposal: ${e.message} — continuing`);
  }
}

// ─── Step 6: checklist summary ──────────────────────────────────────────────

function printChecklist() {
  console.log("\n" + "═".repeat(72));
  console.log("SEED-DEMO — 시딩 완료 요약");
  console.log("═".repeat(72));
  console.log(`파티 ID: ${partyId}`);
  console.log(`봇: ${seedSummary.bots.join(", ") || "(없음)"}`);
  console.log(`상주 중인 봇 소켓: ${partyTags.join(", ") || "(없음)"} (인간이 종료할 때까지 유지)`);
  console.log("");
  console.log("✔ 완료된 시딩:");
  console.log(`  - 3개 봇 계정+프로필 생성, 매치메이킹으로 human과 한 파티에 합류`);
  if (seedSummary.match) {
    console.log(
      `  - 서연 → human 프로포즈 → human이 즉시 수락 → Match+DM방 생성 (matchId=${seedSummary.match.matchId})`,
    );
    console.log(`  - 서연이 DM ${seedSummary.dms}/3건 발송 → 채팅 탭에 대화+안읽음 배지`);
  } else {
    console.log("  - 서연 매치/DM 시딩: 실패 또는 스킵됨 (위 로그 참고)");
  }
  if (seedSummary.datePlan) {
    console.log(
      `  - 서연이 데이트플랜 생성 + 코스 선택 (courseId=${seedSummary.datePlan.courseId})`,
    );
  } else {
    console.log("  - 데이트플랜 시딩: 실패 또는 스킵됨 (위 로그 참고)");
  }
  if (seedSummary.doyoonProposal) {
    console.log(
      `  - 도윤 → human 프로포즈 발송, PENDING 상태로 유지 (id=${seedSummary.doyoonProposal})`,
    );
  } else {
    console.log("  - 도윤 프로포즈 시딩: 실패 또는 스킵됨 (위 로그 참고)");
  }
  console.log("");
  console.log("☐ 사람이 직접 UI에서 확인할 시나리오:");
  console.log("  1. 파티 입장 → 봇 3명(서연/도윤/하은)과 실시간 채팅/이동 확인");
  console.log(
    "     ⚠ 사람이 4번째로 입장하는 순간 어몽어스가 자동 시작됨(수동 시작 버튼 없음, 2a446fc)",
  );
  console.log("  2. (자동 시작된) 어몽어스 → 태스크/AI 임포스터 킬/신고/회의/투표 전 과정 진행");
  console.log(
    "     (인간 4명은 전원 크루 — 봇은 ~15초마다 태스크 1개. 임포스터 2명은 AI 페르소나로 서버가 이동/킬/투표까지 자동 진행)",
  );
  console.log(
    "  3. 어몽어스가 끝난 뒤 밸런스 게임 시작 → 5라운드 전체 플레이 (봇이 자동으로 투표)",
  );
  console.log(
    "     (파티당 ACTIVE 세션은 하나뿐 — 어몽 진행 중엔 밸런스 시작이 already-active로 거부됨)",
  );
  console.log("  4. 알림 탭에서 match/message 알림 확인");
  console.log("  5. 프로포즈 탭에서 도윤의 PENDING 프로포즈 수락");
  console.log("  6. 채팅 탭에서 서연과의 대화 열고 답장 보내기 (봇이 20초 내 1회 응답)");
  console.log("  7. 데이트플랜에서 서연이 선택한 코스 CONFIRM");
  console.log("  8. 안전 신고/차단 메뉴 동작 확인 (설정 등)");
  console.log("═".repeat(72));
  console.log("\n봇이 상주 중입니다. 종료하려면 Ctrl-C (SIGINT)를 누르세요.\n");
}

// ─── Shutdown ───────────────────────────────────────────────────────────────

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — disconnecting bot sockets...`);
  for (const h of timers) {
    clearTimeout(h);
    clearInterval(h);
  }
  for (const bot of bots) {
    if (bot.socket) bot.socket.disconnect();
  }
  console.log("done. bye.");
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`SEED-DEMO starting against ${BASE} (run id ${RID})`);

  await loginHuman();
  await createAllBots();
  await formParty();

  if (partyTags.length === 0) {
    console.error("FATAL: no bots share the human's party — nothing to host or seed. Exiting.");
    process.exit(1);
  }

  startBotHosting();
  await sleep(2500); // let sockets connect + join + greet before firing proposals

  await seedSeoyeonFunnel();
  await seedDoyoonProposal();

  printChecklist();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
