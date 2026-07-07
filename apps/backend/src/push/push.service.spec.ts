import { PushService } from "./push.service";

function makeService(overrides: { user?: any; tokens?: any[] } = {}) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(overrides.user ?? { id: "u1", pushEnabled: true }) },
    deviceToken: {
      findMany: jest.fn().mockResolvedValue(overrides.tokens ?? [{ token: "ExponentPushToken[a]" }]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as any;
  const config = { get: jest.fn().mockReturnValue(undefined) } as any;
  const svc = new PushService(prisma, config);
  return { svc, prisma };
}

it("does not send when pushEnabled is false", async () => {
  const { svc, prisma } = makeService({ user: { id: "u1", pushEnabled: false } });
  const send = jest.spyOn(svc as any, "dispatch").mockResolvedValue([]);
  await svc.sendToUser("u1", { type: "system", title: "t", body: "b" });
  expect(send).not.toHaveBeenCalled();
  expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
});

it("no-ops with zero tokens", async () => {
  const { svc } = makeService({ tokens: [] });
  const send = jest.spyOn(svc as any, "dispatch").mockResolvedValue([]);
  await svc.sendToUser("u1", { type: "system", title: "t", body: "b" });
  expect(send).not.toHaveBeenCalled();
});

it("builds an Expo message with title/body/data and sends it", async () => {
  const { svc } = makeService();
  const dispatch = jest.spyOn(svc as any, "dispatch").mockResolvedValue([{ status: "ok" }]);
  await svc.sendToUser("u1", { type: "message_received", title: "새 메시지", body: "hi", data: { roomId: "r1" } });
  expect(dispatch).toHaveBeenCalledWith([
    expect.objectContaining({
      to: "ExponentPushToken[a]",
      title: "새 메시지",
      body: "hi",
      data: { type: "message_received", roomId: "r1" },
    }),
  ]);
});

it("prunes a token whose ticket reports DeviceNotRegistered", async () => {
  const { svc, prisma } = makeService();
  jest.spyOn(svc as any, "dispatch").mockResolvedValue([
    { status: "error", details: { error: "DeviceNotRegistered" }, message: "x" },
  ]);
  await svc.sendToUser("u1", { type: "system", title: "t", body: "b" });
  expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({ where: { token: "ExponentPushToken[a]" } });
});

it("never throws when dispatch fails", async () => {
  const { svc } = makeService();
  jest.spyOn(svc as any, "dispatch").mockRejectedValue(new Error("network"));
  await expect(svc.sendToUser("u1", { type: "system", title: "t", body: "b" })).resolves.toBeUndefined();
});
