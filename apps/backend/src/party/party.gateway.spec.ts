import { PartyGateway } from "./party.gateway";

const jwt = { verify: jest.fn() } as any;
const party = {
  assertParticipant: jest.fn(),
  addPartyMessage: jest.fn(),
} as any;

function gatewayWith() {
  const gw = new PartyGateway(jwt, party);
  (gw as any).server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
  return gw;
}

function clientWith(userId?: string) {
  return {
    id: `sock-${Math.random()}`,
    data: userId ? { userId } : {},
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    disconnect: jest.fn(),
    handshake: { auth: {} },
  } as any;
}

beforeEach(() => jest.clearAllMocks());

it("handleConnection with no token disconnects", () => {
  const gw = gatewayWith();
  const client = clientWith();
  gw.handleConnection(client);
  expect(client.disconnect).toHaveBeenCalled();
});

it("handleConnection with invalid token disconnects without throwing", () => {
  jwt.verify.mockImplementationOnce(() => {
    throw new Error("bad");
  });
  const gw = gatewayWith();
  const client = clientWith();
  client.handshake.auth.token = "bad.token";
  expect(() => gw.handleConnection(client)).not.toThrow();
  expect(client.disconnect).toHaveBeenCalled();
});

it("party:join joins the room, registers presence, broadcasts the roster", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  expect(client.join).toHaveBeenCalledWith("pt1");
  expect(to).toHaveBeenCalledWith("pt1");
  const emit = to.mock.results[0].value.emit;
  expect(emit).toHaveBeenCalledWith("party:presence", { partyId: "pt1", members: ["pf1"] });
});

it("party:join refuses a non-participant with an error emit", async () => {
  party.assertParticipant.mockResolvedValueOnce(null);
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  expect(client.join).not.toHaveBeenCalled();
  expect(client.emit).toHaveBeenCalledWith("error", { message: "forbidden" });
});

it("party:chat persists then broadcasts party:message to the room", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const view = { id: "m1", partyId: "pt1", profileId: "pf1", content: "hi", createdAt: "t" };
  party.addPartyMessage.mockResolvedValueOnce(view);
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleChat(client, { partyId: "pt1", content: "hi" });
  expect(party.addPartyMessage).toHaveBeenCalledWith("pf1", "pt1", "hi");
  expect(to).toHaveBeenCalledWith("pt1");
  expect(to.mock.results[0].value.emit).toHaveBeenCalledWith("party:message", view);
});

it("party:chat surfaces a validation failure as an error emit (no throw)", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  party.addPartyMessage.mockRejectedValueOnce(new Error("bad"));
  const gw = gatewayWith();
  const client = clientWith("u1");
  await expect(gw.handleChat(client, { partyId: "pt1", content: "" })).resolves.toBeUndefined();
  expect(client.emit).toHaveBeenCalledWith("error", { message: "invalid" });
});

it("party:move broadcasts party:moved to others using join-time membership", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  gw.handleMove(client, { partyId: "pt1", x: 1, y: 2 });
  expect(client.to).toHaveBeenCalledWith("pt1");
  expect(client.to.mock.results[0].value.emit).toHaveBeenCalledWith("party:moved", {
    profileId: "pf1",
    x: 1,
    y: 2,
  });
});

it("party:move from a socket that never joined is ignored", () => {
  const gw = gatewayWith();
  const client = clientWith("u1");
  gw.handleMove(client, { partyId: "pt1", x: 1, y: 2 });
  expect(client.to).not.toHaveBeenCalled();
});

it("handleDisconnect removes presence and re-broadcasts the roster", async () => {
  party.assertParticipant.mockResolvedValue("pf1");
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  gw.handleDisconnect(client);
  const lastEmit = to.mock.results.at(-1)!.value.emit;
  expect(lastEmit).toHaveBeenCalledWith("party:presence", { partyId: "pt1", members: [] });
});
