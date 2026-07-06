import { MessengerGateway } from "./messenger.gateway";

const jwt = { verify: jest.fn() } as any;
const messenger = { assertMember: jest.fn() } as any;

function gatewayWith() {
  const gw = new MessengerGateway(jwt, messenger);
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

it("handleConnection with no token disconnects the client", () => {
  const gw = gatewayWith();
  const client = { handshake: { auth: {} }, disconnect: jest.fn(), data: {} } as any;
  gw.handleConnection(client);
  expect(client.disconnect).toHaveBeenCalled();
  expect(client.data.userId).toBeUndefined();
});

it("handleConnection with invalid token disconnects without throwing", () => {
  jwt.verify.mockImplementationOnce(() => { throw new Error("bad"); });
  const gw = gatewayWith();
  const client = { handshake: { auth: { token: "bad.token" } }, disconnect: jest.fn(), data: {} } as any;
  expect(() => gw.handleConnection(client)).not.toThrow();
  expect(client.disconnect).toHaveBeenCalled();
});
