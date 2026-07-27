#!/usr/bin/env node
/**
 * Hosts five real dev accounts for a full 3:3 speed-date E2E.
 *
 * Start the backend with SPEEDDATE_AI_FILL=false, then run this host before tapping "시작하기"
 * on the human account. The bots use the same REST queue, Socket.IO session, private choice, match,
 * room, and messenger endpoints as the app. Every opposite-gender bot chooses the human, so any
 * person selected by the human produces a mutual match.
 *
 * Usage:
 *   node tools/speed-date-qa-bots.mjs [humanEmail]
 */

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const socketPath = path.join(repoRoot, "node_modules/socket.io-client/build/esm/index.js");
const { io } = await import(socketPath);
const prisma = new PrismaClient();

const base = process.env.MINGLE_QA_API ?? "http://127.0.0.1:3000";
const humanEmail = process.argv[2] ?? "dev@mingle.test";
const botEmails = [
  "qa.speed.seoyeon@mingle.test",
  "qa.speed.haeun@mingle.test",
  "qa.speed.yujin@mingle.test",
  "qa.speed.doyoon@mingle.test",
  "qa.speed.minjun@mingle.test",
  "qa.speed.jiho@mingle.test",
];
const sockets = [];
let shuttingDown = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = () => new Date().toISOString().slice(11, 19);
const log = (tag, message) => console.log(`[${stamp()}] [${tag}] ${message}`);

async function request(pathname, { token, method = "GET", body } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    throw new Error(`${method} ${pathname} → ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function login(email) {
  const session = await request("/auth/dev-login", {
    method: "POST",
    body: { email },
  });
  if (!session?.accessToken) throw new Error(`${email} dev login returned no access token`);
  return session.accessToken;
}

async function waitForSession(profileIds) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const active = await prisma.speedDateSession.findMany({
      where: { status: "active" },
      select: { id: true, state: true },
    });
    const session = active.find((row) => {
      const participants = row.state?.participants ?? [];
      const memberIds = new Set(participants.map((participant) => participant.profileId));
      return profileIds.every((profileId) => memberIds.has(profileId));
    });
    if (session) return session.id;
    await sleep(400);
  }
  throw new Error("The six QA profiles did not enter one speed-date session within 180 seconds");
}

async function writeRuntime(result) {
  const reportDir = path.join(repoRoot, ".gstack/qa-reports");
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    path.join(reportDir, "speed-date-runtime.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
}

async function connectBot(bot, sessionId, human) {
  const socket = io(base, {
    auth: { token: bot.token },
    transports: ["websocket"],
    reconnection: true,
  });
  sockets.push(socket);
  let lastPhase = "";
  let choseHuman = false;
  let sentGreeting = false;

  socket.on("connect", () => {
    socket.emit("speeddate:join", { sessionId });
  });
  socket.on("connect_error", (error) => {
    log(bot.name, `socket connect error: ${error.message}`);
  });
  socket.on("speeddate:error", (error) => {
    log(bot.name, `speed-date error: ${JSON.stringify(error)}`);
  });
  socket.on("speeddate:snapshot", async ({ snapshot }) => {
    if (!snapshot) return;
    const phaseKey = `${snapshot.phase}:${snapshot.stageIndex}:${snapshot.roundIndex}`;
    if (phaseKey !== lastPhase) {
      lastPhase = phaseKey;
      log(
        bot.name,
        `${snapshot.phase} stage=${snapshot.stageIndex + 1}/${snapshot.stageCount} round=${snapshot.roundIndex + 1}/${snapshot.roundCount}`,
      );
    }
    if (
      snapshot.phase === "decision" &&
      bot.gender !== human.gender &&
      !choseHuman
    ) {
      choseHuman = true;
      socket.emit("speeddate:choose", {
        sessionId,
        targetProfileId: human.profileId,
        on: true,
      });
      log(bot.name, `${human.name}님을 비공개 선택`);
    }
    const match = snapshot.phase === "ended"
      ? snapshot.result?.matches?.find((item) => item.profileId === human.profileId)
      : null;
    if (match && !sentGreeting) {
      sentGreeting = true;
      await sleep(1_000);
      await request(`/messenger/rooms/${match.roomId}/messages`, {
        token: bot.token,
        method: "POST",
        body: { content: "오늘 대화 즐거웠어요! 조금 더 이야기해 보고 싶어요 😊" },
      });
      const runtime = {
        status: "matched-and-greeting-sent",
        sessionId,
        human: { email: human.email, profileId: human.profileId, name: human.name },
        matchedBot: {
          email: bot.email,
          profileId: bot.profileId,
          name: bot.name,
        },
        roomId: match.roomId,
        updatedAt: new Date().toISOString(),
      };
      await writeRuntime(runtime);
      log("complete", `${bot.name}님과 매칭, room=${match.roomId}, 첫 메시지 전송 완료`);
    }
  });
}

async function main() {
  await request("/health");
  const humanUser = await prisma.user.findUnique({
    where: { email: humanEmail },
    include: { profile: true },
  });
  if (!humanUser?.profile) throw new Error(`${humanEmail} profile not found; run seed-mobile-qa first`);

  const rows = await prisma.user.findMany({
    where: { email: { in: botEmails } },
    include: { profile: true },
  });
  const available = rows
    .filter((row) => row.profile)
    .map((row) => ({
      email: row.email,
      profileId: row.profile.id,
      name: row.profile.name,
      gender: row.profile.gender,
    }));
  const opposite = available.filter((bot) => bot.gender !== humanUser.profile.gender).slice(0, 3);
  const same = available.filter((bot) => bot.gender === humanUser.profile.gender).slice(0, 2);
  const selected = [...opposite, ...same];
  if (opposite.length !== 3 || same.length !== 2) {
    throw new Error("A full 3:3 group requires three opposite-gender and two same-gender QA bots");
  }

  const human = {
    email: humanUser.email,
    profileId: humanUser.profile.id,
    name: humanUser.profile.name,
    gender: humanUser.profile.gender,
  };
  log("setup", `human=${human.name}(${human.gender}), bots=${selected.map((b) => b.name).join(", ")}`);

  await prisma.speedDateQueueEntry.updateMany({
    where: {
      profileId: { in: selected.map((bot) => bot.profileId) },
      status: "waiting",
    },
    data: { status: "cancelled" },
  });
  for (const bot of selected) {
    bot.token = await login(bot.email);
    await request("/speed-date/queue", { token: bot.token, method: "POST", body: {} });
    log("queue", `${bot.name} 대기열 진입`);
  }

  await writeRuntime({
    status: "waiting-for-human",
    human,
    bots: selected.map(({ token: _token, ...bot }) => bot),
    updatedAt: new Date().toISOString(),
  });
  log("ready", "5명 대기 완료 — 에뮬레이터에서 블라인드 데이트를 시작하세요.");

  const sessionId = await waitForSession([
    human.profileId,
    ...selected.map((bot) => bot.profileId),
  ]);
  log("matched", `3:3 세션 생성: ${sessionId}`);
  for (const bot of selected) await connectBot(bot, sessionId, human);
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("shutdown", signal);
  for (const socket of sockets) socket.disconnect();
  void prisma.$disconnect().finally(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch(async (error) => {
  console.error(error);
  await writeRuntime({
    status: "failed",
    error: error instanceof Error ? error.message : String(error),
    updatedAt: new Date().toISOString(),
  });
  await prisma.$disconnect();
  process.exit(1);
});
