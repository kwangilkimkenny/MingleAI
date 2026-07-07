import { DeviceController } from "./device.controller";

function makeController() {
  const prisma = {
    deviceToken: {
      upsert: jest.fn().mockResolvedValue({ id: "d1" }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { update: jest.fn().mockResolvedValue({ id: "u1", pushEnabled: false }) },
  } as any;
  return { ctrl: new DeviceController(prisma), prisma };
}
const user = { userId: "u1" } as any;

it("register upserts on token (idempotent, reassigns userId)", async () => {
  const { ctrl, prisma } = makeController();
  await ctrl.register(user, { token: "ExponentPushToken[a]", platform: "ios" });
  expect(prisma.deviceToken.upsert).toHaveBeenCalledWith({
    where: { token: "ExponentPushToken[a]" },
    create: { userId: "u1", token: "ExponentPushToken[a]", platform: "ios" },
    update: { userId: "u1", platform: "ios" },
  });
});

it("unregister is scoped to the caller's userId", async () => {
  const { ctrl, prisma } = makeController();
  await ctrl.unregister(user, "ExponentPushToken[a]");
  expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
    where: { token: "ExponentPushToken[a]", userId: "u1" },
  });
});

it("toggle updates the caller's pushEnabled", async () => {
  const { ctrl, prisma } = makeController();
  await ctrl.setPush(user, { pushEnabled: false });
  expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { pushEnabled: false } });
});
