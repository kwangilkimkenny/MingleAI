import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { PartyService } from "./party.service";

@WebSocketGateway({ cors: { origin: true } })
export class PartyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  /** partyId → (socketId → profileId). Presence is ephemeral by design. */
  private readonly presence = new Map<string, Map<string, string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly party: PartyService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) return client.disconnect();
      const payload = this.jwt.verify(token) as { sub: string };
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    for (const [partyId, members] of this.presence) {
      if (members.delete(client.id)) this.broadcastPresence(partyId);
    }
  }

  @SubscribeMessage("party:join")
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { partyId: string }) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    await client.join(body.partyId);
    let members = this.presence.get(body.partyId);
    if (!members) {
      members = new Map();
      this.presence.set(body.partyId, members);
    }
    members.set(client.id, me);
    this.broadcastPresence(body.partyId);
  }

  @SubscribeMessage("party:leave")
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { partyId: string }) {
    if (!body?.partyId) return;
    void client.leave(body.partyId);
    const members = this.presence.get(body.partyId);
    if (members?.delete(client.id)) this.broadcastPresence(body.partyId);
  }

  @SubscribeMessage("party:chat")
  async handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string; content: string },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const message = await this.party.addPartyMessage(me, body.partyId, body.content);
      this.server.to(body.partyId).emit("party:message", message);
    } catch {
      client.emit("error", { message: "invalid" });
    }
  }

  @SubscribeMessage("party:move")
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string; x: number; y: number },
  ) {
    // Membership was proven at party:join — the presence map is the (cheap) authority here.
    const me = this.presence.get(body?.partyId)?.get(client.id);
    if (!me || typeof body.x !== "number" || typeof body.y !== "number") return;
    client.to(body.partyId).emit("party:moved", { profileId: me, x: body.x, y: body.y });
  }

  private async authorize(client: Socket, partyId?: string): Promise<string | null> {
    if (!client.data.userId || !partyId) {
      client.emit("error", { message: "forbidden" });
      return null;
    }
    const me = await this.party.assertParticipant(client.data.userId, partyId);
    if (!me) {
      client.emit("error", { message: "forbidden" });
      return null;
    }
    return me;
  }

  private broadcastPresence(partyId: string) {
    const members = [...new Set(this.presence.get(partyId)?.values() ?? [])];
    this.server.to(partyId).emit("party:presence", { partyId, members });
  }
}
