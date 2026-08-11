import { MessengerGateway } from "./messenger.gateway";

const jwt = { verify: jest.fn() } as any;
const messenger = { assertMember: jest.fn() } as any;
const accountAccess = { findActive: jest.fn().mockResolvedValue({ userId: "ua", role: "user" }) } as any;

function gatewayWith() {
  const gw = new MessengerGateway(jwt, messenger, accountAccess);
  (gw as any).server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
  return gw;
}

it("emitNewMessage broadcasts to the room", () => {
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  gw.emitNewMessage({ roomId: "r1", message: { id: "m1" } as any });
  expect(to).toHaveBeenCalledWith("r1");
});

it("handleJoin joins only when assertMember passes", async () => {
  messenger.assertMember.mockResolvedValueOnce("pa");
  const gw = gatewayWith();
  const client = { data: { userId: "ua" }, join: jest.fn(), emit: jest.fn() } as any;
  await gw.handleJoin(client, { roomId: "r1" });
  expect(client.join).toHaveBeenCalledWith("r1");
});

it("handleJoin refuses when not a member", async () => {
  messenger.assertMember.mockResolvedValueOnce(null);
  const gw = gatewayWith();
  const client = { data: { userId: "ua" }, join: jest.fn(), emit: jest.fn() } as any;
  await gw.handleJoin(client, { roomId: "r1" });
  expect(client.join).not.toHaveBeenCalled();
});

it("handleConnection with no token disconnects the client", async () => {
  const gw = gatewayWith();
  const client = { handshake: { auth: {} }, disconnect: jest.fn(), data: {} } as any;
  await gw.handleConnection(client);
  expect(client.disconnect).toHaveBeenCalled();
  expect(client.data.userId).toBeUndefined();
});

it("handleConnection with invalid token disconnects without throwing", async () => {
  jwt.verify.mockImplementationOnce(() => { throw new Error("bad"); });
  const gw = gatewayWith();
  const client = { handshake: { auth: { token: "bad.token" } }, disconnect: jest.fn(), data: {} } as any;
  await expect(gw.handleConnection(client)).resolves.toBeUndefined();
  expect(client.disconnect).toHaveBeenCalled();
});

// ── 2026-08-11 감사에서 비어 있던 경로 ─────────────────────────────────────

it("typing은 방 멤버에게만, 그것도 보낸 사람 빼고 간다", async () => {
  messenger.assertMember.mockResolvedValueOnce("pa");
  const gw = gatewayWith();
  const toRoom = { emit: jest.fn() };
  const client = { data: { userId: "ua" }, to: jest.fn().mockReturnValue(toRoom), emit: jest.fn() } as any;

  await gw.typingStart(client, { roomId: "r1" });

  expect(client.to).toHaveBeenCalledWith("r1"); // client.to = 나를 제외한 방
  expect(toRoom.emit).toHaveBeenCalledWith("typing", { roomId: "r1", profileId: "pa", isTyping: true });
});

it("멤버가 아니면 typing을 흘리지 않는다", async () => {
  messenger.assertMember.mockResolvedValueOnce(null);
  const gw = gatewayWith();
  const toRoom = { emit: jest.fn() };
  const client = { data: { userId: "ua" }, to: jest.fn().mockReturnValue(toRoom), emit: jest.fn() } as any;

  await gw.typingStart(client, { roomId: "r1" });

  expect(toRoom.emit).not.toHaveBeenCalled();
});

it("typing 연타는 레이트리밋에 걸린다(입력 중 신호로 방을 도배하지 못하게)", async () => {
  messenger.assertMember.mockResolvedValue("pa");
  const gw = gatewayWith();
  const toRoom = { emit: jest.fn() };
  const client = { data: { userId: "ua" }, to: jest.fn().mockReturnValue(toRoom), emit: jest.fn() } as any;

  for (let i = 0; i < 30; i++) await gw.typingStart(client, { roomId: "r1" });

  expect(toRoom.emit.mock.calls.length).toBeLessThanOrEqual(12); // 12/10초
});

it("인증 안 된 소켓의 join은 forbidden", async () => {
  const gw = gatewayWith();
  const client = { data: {}, join: jest.fn(), emit: jest.fn() } as any;

  await gw.handleJoin(client, { roomId: "r1" });

  expect(client.join).not.toHaveBeenCalled();
  expect(client.emit).toHaveBeenCalledWith("messenger:error", { message: "forbidden" });
});

it("join 연타도 레이트리밋에 걸린다", async () => {
  messenger.assertMember.mockResolvedValue("pa");
  const gw = gatewayWith();
  const client = { data: { userId: "ua" }, join: jest.fn(), emit: jest.fn() } as any;

  for (let i = 0; i < 25; i++) await gw.handleJoin(client, { roomId: "r1" });

  expect(client.join.mock.calls.length).toBeLessThanOrEqual(10); // 10/분
});

it("읽음 이벤트는 방 전체로 브로드캐스트된다", () => {
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  gw.emitRead({ roomId: "r1", profileId: "pa", lastReadAt: "2026-08-11T00:00:00.000Z" } as any);
  expect(to).toHaveBeenCalledWith("r1");
});
