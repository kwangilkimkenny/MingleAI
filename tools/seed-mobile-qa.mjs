#!/usr/bin/env node
/**
 * Idempotent mobile QA data for the dev account.
 *
 * Adds realistic profiles, chat rooms/messages, notifications, a pending proposal, and a date
 * plan without deleting user-created data. It also clears only the selected QA accounts' stale
 * speed-date queue/session state so the 3:3 E2E host can start from a reproducible state.
 *
 * Usage:
 *   node tools/seed-mobile-qa.mjs [humanEmail]
 */

import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const humanEmail = process.argv[2] ?? "dev@mingle.test";
const CONSENT_VERSION = "2026-07-22";
const now = new Date();

const QA_PROFILES = [
  {
    key: "seoyeon",
    email: "qa.speed.seoyeon@mingle.test",
    name: "서연",
    age: 28,
    gender: "female",
    occupation: "브랜드 마케터",
    preference: "조용한 카페에서 천천히 대화하고 전시를 함께 보는 만남을 좋아해요.",
    summary: "차분한 카페 대화와 전시 산책을 좋아해요",
    interests: ["전시", "카페", "사진"],
  },
  {
    key: "haeun",
    email: "qa.speed.haeun@mingle.test",
    name: "하은",
    age: 27,
    gender: "female",
    occupation: "간호사",
    preference: "편안하게 웃을 수 있고 서로의 일상을 다정하게 듣는 자리를 좋아해요.",
    summary: "편안한 농담과 다정한 대화를 좋아해요",
    interests: ["러닝", "영화", "맛집"],
  },
  {
    key: "yujin",
    email: "qa.speed.yujin@mingle.test",
    name: "유진",
    age: 30,
    gender: "female",
    occupation: "공간 디자이너",
    preference: "새로운 공간을 발견하고 취향에 관해 깊게 이야기하는 만남을 원해요.",
    summary: "공간과 취향에 관한 깊은 대화를 좋아해요",
    interests: ["인테리어", "재즈", "여행"],
  },
  {
    key: "doyoon",
    email: "qa.speed.doyoon@mingle.test",
    name: "도윤",
    age: 29,
    gender: "male",
    occupation: "제품 개발자",
    preference: "부담 없는 대화와 산책으로 자연스럽게 가까워지는 만남을 좋아해요.",
    summary: "부담 없는 대화와 야간 산책을 좋아해요",
    interests: ["산책", "음악", "커피"],
  },
  {
    key: "minjun",
    email: "qa.speed.minjun@mingle.test",
    name: "민준",
    age: 31,
    gender: "male",
    occupation: "콘텐츠 기획자",
    preference: "서로의 취미를 소개하고 새로운 활동을 함께 시도하는 만남을 원해요.",
    summary: "취미를 나누고 새로운 활동을 해보는 걸 좋아해요",
    interests: ["요리", "보드게임", "공연"],
  },
  {
    key: "jiho",
    email: "qa.speed.jiho@mingle.test",
    name: "지호",
    age: 28,
    gender: "male",
    occupation: "UX 라이터",
    preference: "말을 재촉하지 않고 서로의 속도에 맞춰 대화하는 자리를 좋아해요.",
    summary: "서로의 속도에 맞춘 차분한 대화를 좋아해요",
    interests: ["독서", "드로잉", "베이커리"],
  },
];

function identityHash(kind, email) {
  return createHash("sha256").update(`mobile-qa:${kind}:${email}`).digest("hex");
}

function birthForAge(age) {
  return new Date(Date.UTC(now.getUTCFullYear() - age, 0, 15));
}

async function ensureConsent(userId) {
  for (const scope of ["terms", "privacy", "age19"]) {
    await prisma.consentGrant.upsert({
      where: { userId_scope: { userId, scope } },
      create: { userId, scope, version: CONSENT_VERSION, grantedAt: now },
      update: { version: CONSENT_VERSION },
    });
  }
}

async function ensureQaProfile(seed, index) {
  const user = await prisma.user.upsert({
    where: { email: seed.email },
    create: {
      email: seed.email,
      authProvider: "dev",
      providerId: `mobile-qa-${seed.key}`,
      role: "user",
      phoneNumber: `010-9000-${String(index + 1).padStart(4, "0")}`,
      phoneVerifiedAt: now,
      identityCi: identityHash("ci", seed.email),
      identityDi: identityHash("di", seed.email),
      verifiedName: seed.name,
      verifiedBirth: birthForAge(seed.age),
      verifiedGender: seed.gender,
      termsAcceptedAt: now,
      termsVersion: CONSENT_VERSION,
      privacyVersion: CONSENT_VERSION,
    },
    update: {
      authProvider: "dev",
      providerId: `mobile-qa-${seed.key}`,
      phoneVerifiedAt: now,
      identityCi: identityHash("ci", seed.email),
      identityDi: identityHash("di", seed.email),
      verifiedName: seed.name,
      verifiedBirth: birthForAge(seed.age),
      verifiedGender: seed.gender,
      termsAcceptedAt: now,
      termsVersion: CONSENT_VERSION,
      privacyVersion: CONSENT_VERSION,
    },
  });
  await ensureConsent(user.id);
  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      name: seed.name,
      age: seed.age,
      gender: seed.gender,
      occupation: seed.occupation,
      partyPreferenceText: seed.preference,
      preferenceSignals: {
        pace: "medium",
        vibe: "calm",
        drinking: "social",
        tags: seed.interests,
        activity: seed.interests,
        summary: seed.summary,
      },
      interests: seed.interests,
      bio: seed.summary,
      location: "서울",
    },
    update: {
      name: seed.name,
      age: seed.age,
      gender: seed.gender,
      occupation: seed.occupation,
      partyPreferenceText: seed.preference,
      preferenceSignals: {
        pace: "medium",
        vibe: "calm",
        drinking: "social",
        tags: seed.interests,
        activity: seed.interests,
        summary: seed.summary,
      },
      interests: seed.interests,
      bio: seed.summary,
      location: "서울",
      status: "active",
    },
  });
  return { ...seed, user, profile };
}

function normalizedPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

async function ensureMatch(humanProfile, peer, slot) {
  const [profileId1, profileId2] = normalizedPair(humanProfile.id, peer.profile.id);
  const match = await prisma.match.upsert({
    where: { profileId1_profileId2: { profileId1, profileId2 } },
    create: { profileId1, profileId2 },
    update: {},
  });
  const room = await prisma.directMessageRoom.upsert({
    where: { matchId: match.id },
    create: { matchId: match.id },
    update: {},
  });
  const messages = [
    {
      id: `mobile-qa-${slot}-message-1`,
      senderProfileId: peer.profile.id,
      content: slot === 1 ? "오늘 로테이션 대화 즐거웠어요 :)" : "추천해 준 카페 찾아봤어요!",
      minutesAgo: slot === 1 ? 42 : 1440,
      readAt: slot === 1 ? null : new Date(now.getTime() - 1_430 * 60_000),
    },
    {
      id: `mobile-qa-${slot}-message-2`,
      senderProfileId: humanProfile.id,
      content: slot === 1 ? "저도요. 다음엔 조금 더 길게 이야기해요." : "분위기가 좋아 보여서 같이 가면 좋겠어요.",
      minutesAgo: slot === 1 ? 39 : 1_420,
      readAt: slot === 1 ? null : new Date(now.getTime() - 1_410 * 60_000),
    },
    {
      id: `mobile-qa-${slot}-message-3`,
      senderProfileId: peer.profile.id,
      content: slot === 1 ? "좋아요! 이번 주말은 어때요?" : "토요일 오후 괜찮아요?",
      minutesAgo: slot === 1 ? 35 : 1_400,
      readAt: null,
    },
  ];
  for (const message of messages) {
    await prisma.directMessage.upsert({
      where: { id: message.id },
      create: {
        id: message.id,
        roomId: room.id,
        senderProfileId: message.senderProfileId,
        content: message.content,
        readAt: message.readAt,
        createdAt: new Date(now.getTime() - message.minutesAgo * 60_000),
      },
      update: {
        roomId: room.id,
        senderProfileId: message.senderProfileId,
        content: message.content,
        readAt: message.readAt,
      },
    });
  }
  return { match, room };
}

async function clearQaSpeedDateState(profileIds) {
  await prisma.speedDateQueueEntry.updateMany({
    where: { profileId: { in: profileIds }, status: "waiting" },
    data: { status: "cancelled" },
  });
  const active = await prisma.speedDateSession.findMany({
    where: { status: "active" },
    select: { id: true, state: true },
  });
  for (const session of active) {
    const participants = session.state?.participants ?? [];
    if (!participants.some((p) => profileIds.includes(p.profileId))) continue;
    await prisma.speedDateSession.update({
      where: { id: session.id },
      data: { status: "ended", endedAt: now },
    });
  }
}

async function main() {
  const human = await prisma.user.findUnique({
    where: { email: humanEmail },
    include: { profile: true },
  });
  if (!human?.profile) {
    throw new Error(`${humanEmail} 계정의 온보딩 프로필이 없습니다.`);
  }

  await ensureConsent(human.id);
  const peers = [];
  for (let index = 0; index < QA_PROFILES.length; index += 1) {
    peers.push(await ensureQaProfile(QA_PROFILES[index], index));
  }

  const opposite = peers.filter((peer) => peer.profile.gender !== human.profile.gender);
  if (opposite.length < 3) throw new Error("3:3 테스트에 필요한 반대 성별 프로필이 부족합니다.");

  const firstRoom = await ensureMatch(human.profile, opposite[0], 1);
  const secondRoom = await ensureMatch(human.profile, opposite[1], 2);

  const party = await prisma.party.upsert({
    where: { id: "mobile-qa-party" },
    create: {
      id: "mobile-qa-party",
      name: "성수 저녁 로테이션",
      status: "active",
      maxParticipants: 6,
      location: "서울 성수",
      startedAt: new Date(now.getTime() - 2 * 60 * 60_000),
    },
    update: { status: "active", name: "성수 저녁 로테이션", location: "서울 성수" },
  });
  await prisma.partyParticipant.upsert({
    where: {
      partyId_profileId: { partyId: party.id, profileId: human.profile.id },
    },
    create: { partyId: party.id, profileId: human.profile.id },
    update: {},
  });
  await prisma.partyParticipant.upsert({
    where: {
      partyId_profileId: { partyId: party.id, profileId: opposite[2].profile.id },
    },
    create: { partyId: party.id, profileId: opposite[2].profile.id },
    update: {},
  });
  const proposal = await prisma.proposal.upsert({
    where: {
      partyId_fromProfileId_toProfileId: {
        partyId: party.id,
        fromProfileId: opposite[2].profile.id,
        toProfileId: human.profile.id,
      },
    },
    create: {
      partyId: party.id,
      fromProfileId: opposite[2].profile.id,
      toProfileId: human.profile.id,
      status: "pending",
    },
    update: { status: "pending", respondedAt: null },
  });

  await prisma.datePlan.upsert({
    where: { id: "mobile-qa-date-plan" },
    create: {
      id: "mobile-qa-date-plan",
      matchId: secondRoom.match.id,
      creatorProfileId: human.profile.id,
      status: "draft",
      constraints: {
        date: "2026-08-01",
        area: "성수",
        budgetPerPerson: 40000,
        mood: "조용한 대화",
      },
      courses: [
        {
          id: "course-cafe-walk",
          title: "카페와 서울숲 산책",
          places: ["로우키", "서울숲"],
          estimatedCost: 32000,
        },
      ],
    },
    update: {
      matchId: secondRoom.match.id,
      creatorProfileId: human.profile.id,
      status: "draft",
    },
  });

  const notificationSeeds = [
    {
      id: "mobile-qa-notification-match",
      type: "match_made",
      title: "새로운 매칭",
      message: `${opposite[0].name}님과 서로 선택했어요.`,
      data: { matchId: firstRoom.match.id, roomId: firstRoom.room.id },
      minutesAgo: 34,
    },
    {
      id: "mobile-qa-notification-message",
      type: "message_received",
      title: "새 메시지",
      message: "좋아요! 이번 주말은 어때요?",
      data: { roomId: firstRoom.room.id },
      minutesAgo: 33,
    },
    {
      id: "mobile-qa-notification-proposal",
      type: "proposal_received",
      title: "새로운 호감",
      message: `${opposite[2].name}님이 대화를 더 이어가고 싶어 해요.`,
      data: { proposalId: proposal.id },
      minutesAgo: 18,
    },
    {
      id: "mobile-qa-notification-reminder",
      type: "party_reminder",
      title: "오늘의 로테이션",
      message: "오늘 오후 8시, 온라인 로테이션이 시작돼요.",
      data: { partyId: party.id },
      minutesAgo: 8,
    },
  ];
  for (const notification of notificationSeeds) {
    const { minutesAgo, ...notificationData } = notification;
    await prisma.notification.upsert({
      where: { id: notification.id },
      create: {
        ...notificationData,
        userId: human.id,
        read: false,
        createdAt: new Date(now.getTime() - minutesAgo * 60_000),
      },
      update: {
        userId: human.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        read: false,
      },
    });
  }

  const scopedProfileIds = [human.profile.id, ...peers.map((peer) => peer.profile.id)];
  await clearQaSpeedDateState(scopedProfileIds);

  console.log(
    JSON.stringify(
      {
        human: {
          email: human.email,
          profileId: human.profile.id,
          name: human.profile.name,
          gender: human.profile.gender,
        },
        mockProfiles: peers.map((peer) => ({
          email: peer.email,
          profileId: peer.profile.id,
          name: peer.name,
          gender: peer.gender,
        })),
        chats: [
          { peer: opposite[0].name, roomId: firstRoom.room.id, unread: 2 },
          { peer: opposite[1].name, roomId: secondRoom.room.id, unread: 1 },
        ],
        pendingProposal: { from: opposite[2].name, proposalId: proposal.id },
        notifications: notificationSeeds.length,
        speedDateState: "ready",
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
