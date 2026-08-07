import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { MessengerService } from "./messenger.service";

const cfg = { get: () => "2000" } as any;
const safety = { isBlockedBetween: jest.fn().mockResolvedValue(false) } as any;
const notify = { create: jest.fn().mockResolvedValue({}) } as any;
const emitter = { emitNewMessage: jest.fn(), emitRead: jest.fn() };

const room = { id: "r1", match: { profileId1: "pa", profileId2: "pb" } };
function prismaWith(over: any = {}) {
  return {
    profile: { findUnique: jest.fn().mockResolvedValue({ id: "pa", userId: "ua", status: "active" }) },
    directMessageRoom: { findUnique: jest.fn().mockResolvedValue(room) },
    directMessage: { create: jest.fn().mockResolvedValue({ id: "m1", roomId: "r1", senderProfileId: "pa", content: "hi", readAt: null, createdAt: new Date() }), updateMany: jest.fn().mockResolvedValue({ count: 2 }), findMany: jest.fn().mockResolvedValue([]) },
    ...over,
  } as any;
}
const suggester = { kind: "ai", suggest: jest.fn().mockResolvedValue(["가장 좋아하는 음식이 뭐예요?"]) } as any;
function svc(prisma: any) {
  return new MessengerService(prisma, cfg, safety, notify, emitter, suggester);
}

it("send → 403 when the caller is not a member of the room", async () => {
  const prisma = prismaWith({ directMessageRoom: { findUnique: jest.fn().mockResolvedValue({ id: "r1", match: { profileId1: "px", profileId2: "py" } }) } });
  await expect(svc(prisma).send("ua", "r1", "hi")).rejects.toBeInstanceOf(ForbiddenException);
});

it("send → 403 when blocked", async () => {
  safety.isBlockedBetween.mockResolvedValueOnce(true);
  await expect(svc(prismaWith()).send("ua", "r1", "hi")).rejects.toBeInstanceOf(ForbiddenException);
});

it("send → 400 when content is empty or too long", async () => {
  await expect(svc(prismaWith()).send("ua", "r1", "")).rejects.toBeInstanceOf(BadRequestException);
  await expect(svc(prismaWith()).send("ua", "r1", "x".repeat(2001))).rejects.toBeInstanceOf(BadRequestException);
});

it("send → persists, emits message:new, notifies the recipient", async () => {
  const prisma = prismaWith();
  const res = await svc(prisma).send("ua", "r1", "hi");
  expect(prisma.directMessage.create).toHaveBeenCalled();
  expect(emitter.emitNewMessage).toHaveBeenCalledWith(expect.objectContaining({ roomId: "r1" }));
  expect(notify.create).toHaveBeenCalledWith(expect.objectContaining({ type: "message_received" }));
  expect(res.content).toBe("hi");
});

it("markRead → sets unread read, emits room-level message:read", async () => {
  const prisma = prismaWith();
  await svc(prisma).markRead("ua", "r1");
  expect(prisma.directMessage.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ roomId: "r1", senderProfileId: { not: "pa" }, readAt: null }) }));
  expect(emitter.emitRead).toHaveBeenCalledWith(expect.objectContaining({ roomId: "r1", readerProfileId: "pa" }));
});

it("send → notification failure does not reject; dto is still returned", async () => {
  notify.create.mockRejectedValueOnce(new Error("notify down"));
  const res = await svc(prismaWith()).send("ua", "r1", "hi");
  expect(res.content).toBe("hi");
});

// F2: block enforcement now lives in memberContext, so it covers read paths + the gateway, not just send.
it("history → 403 when the pair is blocked (F2)", async () => {
  safety.isBlockedBetween.mockResolvedValueOnce(true);
  await expect(svc(prismaWith()).history("ua", "r1", undefined, 50)).rejects.toBeInstanceOf(ForbiddenException);
});

it("markRead → 403 when the pair is blocked (F2)", async () => {
  safety.isBlockedBetween.mockResolvedValueOnce(true);
  await expect(svc(prismaWith()).markRead("ua", "r1")).rejects.toBeInstanceOf(ForbiddenException);
});

it("assertMember → returns null when the pair is blocked so the gateway rejects join/typing (F2)", async () => {
  safety.isBlockedBetween.mockResolvedValueOnce(true);
  await expect(svc(prismaWith()).assertMember("ua", "r1")).resolves.toBeNull();
});

describe("다음 멘트 추천", () => {
  const withMessages = (rows: any[]) =>
    prismaWith({
      directMessage: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue(rows),
      },
    });

  it("최근 대화를 나/상대 역할로만 넘긴다(이름·id는 프롬프트에 넣지 않는다)", async () => {
    suggester.suggest.mockResolvedValue(["좋아하는 음식이 뭐예요?"]);
    const prisma = withMessages([
      { senderProfileId: "pb", content: "안녕하세요", createdAt: new Date(2) },
      { senderProfileId: "pa", content: "반가워요", createdAt: new Date(1) },
    ]);
    const res = await svc(prisma).suggestReplies("ua", "r1");
    expect(res.source).toBe("ai");
    const arg = suggester.suggest.mock.calls.at(-1)[0];
    // findMany는 최신순 → 서비스가 뒤집어 오래된 것부터 넘긴다
    expect(arg.turns).toEqual([
      { role: "me", content: "반가워요" },
      { role: "peer", content: "안녕하세요" },
    ]);
    expect(JSON.stringify(arg)).not.toContain("pa");
  });

  it("긴 메시지는 잘라서 보낸다", async () => {
    suggester.suggest.mockResolvedValue(["네"]);
    const prisma = withMessages([{ senderProfileId: "pb", content: "가".repeat(1000), createdAt: new Date() }]);
    await svc(prisma).suggestReplies("ua", "r1");
    expect(suggester.suggest.mock.calls.at(-1)[0].turns[0].content).toHaveLength(300);
  });

  it("LLM이 실패해도 규칙 기반 추천으로 3개를 돌려준다", async () => {
    suggester.suggest.mockRejectedValue(new Error("LLM 500"));
    const prisma = withMessages([{ senderProfileId: "pb", content: "여행 좋아해요", createdAt: new Date() }]);
    const res = await svc(prisma).suggestReplies("ua", "r1");
    expect(res.source).toBe("fallback");
    expect(res.suggestions).toHaveLength(3);
  });

  it("방 멤버가 아니면 거부한다", async () => {
    const prisma = prismaWith({
      directMessageRoom: { findUnique: jest.fn().mockResolvedValue({ id: "r1", match: { profileId1: "px", profileId2: "py" } }) },
    });
    await expect(svc(prisma).suggestReplies("ua", "r1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("차단된 상대의 방이면 거부한다", async () => {
    safety.isBlockedBetween.mockResolvedValueOnce(true);
    await expect(svc(withMessages([])).suggestReplies("ua", "r1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("이미지 첨부", () => {
  it("사진만 보낼 수 있다(캡션 없이)", async () => {
    const prisma = prismaWith();
    prisma.directMessage.create = jest.fn().mockResolvedValue({
      id: "m2", roomId: "r1", senderProfileId: "pa", content: "", imageUrl: "/uploads/a.jpg",
      readAt: null, createdAt: new Date(),
    });
    const dto = await svc(prisma).send("ua", "r1", "", "/uploads/a.jpg");
    expect(dto.imageUrl).toBe("/uploads/a.jpg");
    expect(prisma.directMessage.create).toHaveBeenCalledWith({
      data: { roomId: "r1", senderProfileId: "pa", content: "", imageUrl: "/uploads/a.jpg" },
    });
  });

  it("절대 URL로 온 우리 업로드 경로도 받는다", async () => {
    const prisma = prismaWith();
    prisma.directMessage.create = jest.fn().mockResolvedValue({
      id: "m3", roomId: "r1", senderProfileId: "pa", content: "", imageUrl: "http://10.0.2.2:3000/uploads/b.png",
      readAt: null, createdAt: new Date(),
    });
    await expect(
      svc(prisma).send("ua", "r1", "", "http://10.0.2.2:3000/uploads/b.png"),
    ).resolves.toBeDefined();
  });

  it("외부 이미지 URL은 거부한다(추적 픽셀·IP 노출 통로)", async () => {
    await expect(
      svc(prismaWith()).send("ua", "r1", "", "https://evil.example.com/pixel.png"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("업로드 경로를 흉내 낸 상위 이동은 거부한다", async () => {
    await expect(
      svc(prismaWith()).send("ua", "r1", "", "/uploads/../../etc/passwd"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("텍스트도 이미지도 없으면 거부한다", async () => {
    await expect(svc(prismaWith()).send("ua", "r1", "   ")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("사진만 보내면 알림 문구가 '사진을 보냈어요'가 된다", async () => {
    const prisma = prismaWith();
    prisma.directMessage.create = jest.fn().mockResolvedValue({
      id: "m4", roomId: "r1", senderProfileId: "pa", content: "", imageUrl: "/uploads/c.webp",
      readAt: null, createdAt: new Date(),
    });
    await svc(prisma).send("ua", "r1", "", "/uploads/c.webp");
    expect(notify.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: "사진을 보냈어요" }),
    );
  });
});
