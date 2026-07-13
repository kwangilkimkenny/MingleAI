/**
 * among-bots.mjs — AI bot runner for MingleAI "Among Us" party minigame (Phase 6d).
 *
 * Usage:
 *   node tools/among-bots.mjs <count> [--start] [--party <id>] [--token-file <path>]
 *
 * Default: registers <count> bots, queues them for matchmaking, waits for a party,
 * then connects them all via Socket.IO and plays a full Among Us game.
 * --start: first bot emits among:start once enough players are in the party.
 * --party <id>: skip matchmaking, use a known partyId (bots still register/login).
 * --token-file <path>: JSON array of {email,token,profileId} to skip registration.
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Resolve socket.io-client from the monorepo root
const REPO_ROOT = path.resolve(__dirname, "..");
const SIO_PATH = path.join(REPO_ROOT, "node_modules/socket.io-client/build/esm/index.js");
const { io: socketIo } = await import(SIO_PATH);

// ─── CLI args ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const count = parseInt(argv[0] ?? "4", 10);
if (isNaN(count) || count < 1) { console.error("Usage: node among-bots.mjs <count> [--start] [--party <id>]"); process.exit(1); }

let flagStart = false;
let flagPartyId = null;
let flagTokenFile = null;

for (let i = 1; i < argv.length; i++) {
  if (argv[i] === "--start") flagStart = true;
  else if (argv[i] === "--party" && argv[i + 1]) { flagPartyId = argv[++i]; }
  else if (argv[i] === "--token-file" && argv[i + 1]) { flagTokenFile = argv[++i]; }
}

const BASE = process.env.BASE ?? "http://localhost:3000";
const OVERALL_TIMEOUT_MS = 180_000;

// ─── Utilities ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (tag, ...args) => console.log(`[${new Date().toISOString()}] [${tag}]`, ...args);

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${opts.method ?? "GET"} ${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

// ─── Inline copies from party-space.ts (can't import TS directly) ──────────
const ROOM_MARGIN = 0.06;
const MOVE_SPEED = 0.35; // normalized units/sec
const EMIT_MIN_INTERVAL_MS = 100;
const EMIT_MIN_DELTA = 0.005;

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
  return {
    x: current.x + (dx / dist) * step,
    y: current.y + (dy / dist) * step,
  };
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

function dist2(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ─── Bot registration / matchmaking ────────────────────────────────────────
const NAMES = ["지민", "서준", "하윤", "도현", "수아", "예은", "민재", "지우"];
const JOBS  = ["디자이너", "개발자", "마케터", "교사", "간호사", "바리스타", "PD", "요리사"];
const GENDERS = ["male", "female"];

const rid = Date.now().toString(36);

async function registerBot(i) {
  const email = `among_${rid}_${i}@bot.test`;
  const reg = await apiFetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "botpass123" }),
  });
  const auth = { Authorization: `Bearer ${reg.accessToken}` };
  const profile = await apiFetch("/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      name: NAMES[(i + rid.length) % NAMES.length],
      age: 24 + (i % 8),
      gender: GENDERS[i % 2],
      occupation: JOBS[i % JOBS.length],
      partyPreferenceText: "가볍게 어울리면서 미니게임 즐기는 분위기 좋아요",
    }),
  });
  log(`bot${i}`, `registered → profileId=${profile.id} email=${email}`);
  return { email, token: reg.accessToken, profileId: profile.id };
}

async function enqueueBot(bot, i) {
  try {
    await apiFetch("/matchmaking/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bot.token}` },
      body: JSON.stringify({}),
    });
    log(`bot${i}`, "enqueued in matchmaking");
  } catch (e) {
    // May already be queued (e.g. P2002); not fatal
    log(`bot${i}`, `enqueue warn: ${e.message}`);
  }
}

async function pollStatus(bot, i, maxWaitMs = 60_000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(1500);
    try {
      const s = await apiFetch("/matchmaking/status", {
        headers: { Authorization: `Bearer ${bot.token}` },
      });
      if (s.status === "matched" && s.matchedPartyId) {
        log(`bot${i}`, `matched → partyId=${s.matchedPartyId}`);
        return s.matchedPartyId;
      }
      log(`bot${i}`, `waiting (status=${s.status})`);
    } catch (e) {
      log(`bot${i}`, `poll error: ${e.message}`);
    }
  }
  return null;
}

// ─── Per-bot Socket.IO game player ─────────────────────────────────────────

function createBotPlayer({ bot, botIndex, partyId, isFirstBot }) {
  let myPos = spawnFor(bot.profileId);
  const others = new Map(); // profileId → {x, y}

  let snapshot = null; // latest AmongSnapshot
  let lastMoveAt = 0;
  let lastSentPos = null;
  let doneTaskIds = new Set();
  let hasVoted = false;
  let tickInterval = null;
  let startRetryCount = 0;
  let gameStarted = false;
  let resultLogged = false;
  let joined = false;

  const tag = `bot${botIndex}(${bot.profileId.slice(-6)})`;

  const socket = socketIo(BASE, {
    auth: { token: bot.token },
    transports: ["websocket"],
  });

  function emitMove() {
    const now = Date.now();
    if (now - lastMoveAt < EMIT_MIN_INTERVAL_MS) return;
    if (lastSentPos && dist2(myPos, lastSentPos) < EMIT_MIN_DELTA) return;
    socket.emit("party:move", { partyId, x: myPos.x, y: myPos.y });
    lastMoveAt = now;
    lastSentPos = { ...myPos };
  }

  function tick() {
    if (!snapshot || !joined) return;
    const { phase, myRole, myProfileId, players, myTasks, bodies, killCooldownUntil, meeting, result } = snapshot;

    // Log and exit on result
    if (result && !resultLogged) {
      resultLogged = true;
      log(tag, `GAME RESULT → winner=${result.winner} reason=${result.reason}`);
      return;
    }

    const mePlayer = players.find((p) => p.profileId === myProfileId);
    const amAlive = mePlayer?.alive ?? false;

    if (phase === "playing" && amAlive) {
      if (myRole === "crew") {
        // Find nearest undone task
        const undone = myTasks.filter((t) => !t.done && !doneTaskIds.has(t.taskId));
        if (undone.length === 0) return; // all tasks done

        undone.sort((a, b) => dist2(myPos, a) - dist2(myPos, b));
        const target = undone[0];
        myPos = stepToward(myPos, target, 150);
        emitMove();

        // If within task range, complete it (400ms debounce per task)
        if (dist2(myPos, target) < 0.10) {
          if (!doneTaskIds.has(target.taskId + "_pending")) {
            doneTaskIds.add(target.taskId + "_pending");
            const capturedTaskId = target.taskId;
            const capturedKind = target.kind;
            const capturedX = target.x;
            const capturedY = target.y;
            setTimeout(() => {
              if (doneTaskIds.has(capturedTaskId)) return; // already done
              // Guard: only emit if still in playing phase
              if (!snapshot || snapshot.phase !== "playing" || snapshot.result) return;
              doneTaskIds.add(capturedTaskId);
              socket.emit("among:task", { partyId, taskId: capturedTaskId, x: capturedX, y: capturedY });
              log(tag, `task complete: ${capturedTaskId} (kind=${capturedKind})`);
            }, 400 + Math.random() * 200);
          }
        }

      } else if (myRole === "impostor") {
        // Find nearest alive crew (not myself)
        const aliveCrew = players.filter(
          (p) => p.alive && p.profileId !== myProfileId && p.role !== "impostor"
        );

        if (aliveCrew.length === 0) return;

        // Get positions (from party:moved events, fallback to spawnFor)
        aliveCrew.sort((a, b) => {
          const posA = others.get(a.profileId) ?? spawnFor(a.profileId);
          const posB = others.get(b.profileId) ?? spawnFor(b.profileId);
          return dist2(myPos, posA) - dist2(myPos, posB);
        });

        const targetPlayer = aliveCrew[0];
        const targetPos = others.get(targetPlayer.profileId) ?? spawnFor(targetPlayer.profileId);

        myPos = stepToward(myPos, targetPos, 150);
        emitMove();

        const killRange = 0.12;
        const now = Date.now();
        const canKill = killCooldownUntil === null || killCooldownUntil <= now;

        if (dist2(myPos, targetPos) < killRange && canKill) {
          socket.emit("among:kill", {
            partyId,
            targetProfileId: targetPlayer.profileId,
            x: targetPos.x,
            y: targetPos.y,
          });
          log(tag, `KILL → ${targetPlayer.profileId.slice(-6)} (${targetPlayer.name})`);
        }

        // Report nearby unreported body
        for (const body of bodies) {
          if (dist2(myPos, body) < killRange) {
            // Impostor can also report (makes them look innocent)
            // Only report occasionally to seem natural
            if (Math.random() < 0.1) {
              socket.emit("among:report", { partyId, bodyProfileId: body.profileId });
              log(tag, `report body: ${body.profileId.slice(-6)}`);
              break;
            }
          }
        }
      }
    }

    if ((phase === "meeting" || phase === "voting") && amAlive && meeting?.phase === "voting") {
      if (!hasVoted || !meeting.votedProfileIds.includes(myProfileId)) {
        // Check if we haven't voted yet this meeting
        if (!meeting.votedProfileIds.includes(myProfileId)) {
          hasVoted = false; // reset on new meeting
        }
        if (!hasVoted) {
          hasVoted = true;
          // Pick a random alive player to vote, or skip 30% of the time
          const alivePlayers = players.filter((p) => p.alive && p.profileId !== myProfileId);
          setTimeout(() => {
            // Guard: only emit if still in voting phase and game not ended
            if (!snapshot || snapshot.phase !== "voting" || snapshot.result) return;
            let target;
            if (Math.random() < 0.3 || alivePlayers.length === 0) {
              target = "skip";
            } else {
              target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)].profileId;
            }
            socket.emit("among:vote", { partyId, targetProfileId: target });
            log(tag, `vote → ${target === "skip" ? "skip" : target.slice(-6)}`);
          }, 500 + Math.random() * 2000);
        }
      }
    }

    // Reset vote flag when meeting ends
    if (phase === "playing" && hasVoted) {
      hasVoted = false;
    }
  }

  socket.on("connect", () => {
    log(tag, `connected (socket=${socket.id})`);
    socket.emit("party:join", { partyId });
    setTimeout(() => {
      socket.emit("among:sync", { partyId });
    }, 300);
    joined = true;

    // If first bot and --start, try to start the game after a delay
    if (isFirstBot && flagStart && !gameStarted) {
      setTimeout(() => tryStart(), 3000);
    }
  });

  async function tryStart() {
    if (gameStarted) return;
    if (startRetryCount >= 15) {
      log(tag, "could not start game after 15 retries — giving up");
      return;
    }
    log(tag, `emit among:start (attempt ${startRetryCount + 1})`);
    socket.emit("among:start", { partyId });
    startRetryCount++;
  }

  socket.on("party:error", (data) => {
    log(tag, `party:error → ${JSON.stringify(data)}`);
    if (isFirstBot && flagStart && !gameStarted && data?.message === "not-enough-players") {
      setTimeout(() => tryStart(), 2000);
    }
  });

  socket.on("party:presence", (data) => {
    log(tag, `presence → ${data.members?.length ?? 0} members`);
  });

  socket.on("party:moved", (data) => {
    if (data?.profileId && data.profileId !== bot.profileId) {
      others.set(data.profileId, { x: data.x, y: data.y });
    }
  });

  socket.on("among:state", (data) => {
    if (!data?.snapshot) return;
    const prev = snapshot;
    snapshot = data.snapshot;

    const { phase, myRole, result } = snapshot;

    // Log role reveal on first snapshot with a role
    if (!prev && myRole) {
      log(tag, `role revealed: ${myRole}`);
    } else if (prev && !prev.myRole && myRole) {
      log(tag, `role revealed: ${myRole}`);
    }

    // Mark game as started when we first see "playing"
    if (phase === "playing" && !gameStarted) {
      gameStarted = true;
      log(tag, "game started (phase=playing)");
    }

    // Log phase transitions
    if (prev && prev.phase !== phase) {
      log(tag, `phase: ${prev.phase} → ${phase}`);
    }

    // Log result
    if (result && !resultLogged) {
      resultLogged = true;
      log(tag, `GAME RESULT → winner=${result.winner} reason=${result.reason}`);
    }

    // Reset doneTaskIds when a new game starts (sessionId changes)
    if (prev && prev.sessionId !== snapshot.sessionId) {
      doneTaskIds = new Set();
      hasVoted = false;
      gameStarted = false;
    }
  });

  socket.on("connect_error", (err) => {
    log(tag, `connect_error: ${err.message}`);
  });

  socket.on("disconnect", (reason) => {
    log(tag, `disconnected: ${reason}`);
  });

  // Start tick loop
  tickInterval = setInterval(tick, 150);

  return {
    stop() {
      if (tickInterval) clearInterval(tickInterval);
      socket.disconnect();
    },
    getSnapshot() { return snapshot; },
    isResultLogged() { return resultLogged; },
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  // Step 1: Get bot credentials
  let bots;
  if (flagTokenFile) {
    bots = JSON.parse(fs.readFileSync(flagTokenFile, "utf8"));
    log("main", `loaded ${bots.length} bots from ${flagTokenFile}`);
  } else {
    log("main", `registering ${count} bots...`);
    bots = [];
    for (let i = 0; i < count; i++) {
      bots.push(await registerBot(i));
    }
    log("main", "all bots registered");
  }

  // Step 2: Determine partyId
  let partyId = flagPartyId;
  if (!partyId) {
    log("main", "enqueuing bots for matchmaking...");
    // Enqueue all bots in parallel
    await Promise.all(bots.map((bot, i) => enqueueBot(bot, i)));

    log("main", "polling matchmaking status...");
    // Poll all bots in parallel
    const partyIds = await Promise.all(bots.map((bot, i) => pollStatus(bot, i)));

    // Find the partyId shared by the most bots
    const tally = new Map();
    for (const pid of partyIds) {
      if (pid) tally.set(pid, (tally.get(pid) ?? 0) + 1);
    }

    let bestParty = null;
    let bestCount = 0;
    for (const [pid, cnt] of tally) {
      if (cnt > bestCount) { bestParty = pid; bestCount = cnt; }
    }

    if (!bestParty) {
      log("main", "ERROR: no bots matched to a party. Exiting.");
      process.exit(1);
    }

    partyId = bestParty;
    log("main", `party determined: ${partyId} (${bestCount}/${count} bots in this party)`);

    // Filter only bots in the winning party
    const inParty = [];
    for (let i = 0; i < bots.length; i++) {
      if (partyIds[i] === partyId) inParty.push(bots[i]);
    }
    bots = inParty;
    log("main", `${bots.length} bot(s) will play in party ${partyId}`);
  }

  // Step 3: Connect all bots via Socket.IO
  log("main", `connecting ${bots.length} bots to party ${partyId}...`);
  const players = bots.map((bot, i) =>
    createBotPlayer({
      bot,
      botIndex: i,
      partyId,
      isFirstBot: i === 0,
    })
  );

  // Step 4: Wait for game result or timeout
  const deadline = startTime + OVERALL_TIMEOUT_MS;

  await new Promise((resolve) => {
    const check = setInterval(() => {
      const now = Date.now();

      // Check if any player has a result
      const snapshots = players.map((p) => p.getSnapshot()).filter(Boolean);
      const withResult = snapshots.find((s) => s.result !== null);

      if (withResult) {
        log("main", `=== GAME OVER ===`);
        log("main", `winner: ${withResult.result.winner}`);
        log("main", `reason: ${withResult.result.reason}`);
        log("main", `players:`);
        for (const p of withResult.players) {
          log("main", `  ${p.name} (${p.profileId.slice(-6)}) alive=${p.alive} role=${p.role ?? "hidden"}`);
        }
        clearInterval(check);
        resolve();
        return;
      }

      if (now >= deadline) {
        log("main", "TIMEOUT (180s) — printing last known state:");
        for (let i = 0; i < players.length; i++) {
          const s = players[i].getSnapshot();
          if (s) {
            log(`bot${i}`, `phase=${s.phase} role=${s.myRole} alive=${s.players.find(p=>p.profileId===s.myProfileId)?.alive} tasks=${s.progress.done}/${s.progress.total}`);
          } else {
            log(`bot${i}`, "no snapshot received");
          }
        }
        clearInterval(check);
        resolve();
      }
    }, 500);
  });

  // Cleanup
  for (const p of players) p.stop();
  log("main", "all bots disconnected, exiting");
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
