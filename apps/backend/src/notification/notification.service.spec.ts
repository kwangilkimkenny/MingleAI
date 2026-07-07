import { NotificationService } from "./notification.service";

function make() {
  const prisma = { notification: { create: jest.fn().mockResolvedValue({ id: "n1" }) } } as any;
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) } as any;
  return { svc: new NotificationService(prisma, push), prisma, push };
}

it("writes the in-app row AND sends a best-effort push", async () => {
  const { svc, prisma, push } = make();
  const row = await svc.create({
    userId: "u1",
    type: "message_received",
    title: "새 메시지",
    message: "hi",
    data: { roomId: "r1" },
  });
  expect(row).toEqual({ id: "n1" });
  expect(prisma.notification.create).toHaveBeenCalled();
  expect(push.sendToUser).toHaveBeenCalledWith("u1", {
    type: "message_received",
    title: "새 메시지",
    body: "hi",
    data: { roomId: "r1" },
  });
});

it("still returns the row when push throws (non-fatal)", async () => {
  const { svc, push } = make();
  push.sendToUser.mockRejectedValue(new Error("expo down"));
  await expect(
    svc.create({ userId: "u1", type: "system", title: "t", message: "m" }),
  ).resolves.toEqual({ id: "n1" });
});
