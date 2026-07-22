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
function svc(prisma: any) {
  return new MessengerService(prisma, cfg, safety, notify, emitter);
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
