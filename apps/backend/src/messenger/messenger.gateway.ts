import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  type OnGatewayConnection,
} from "@nestjs/websockets";
import { forwardRef, Inject } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { MessengerService } from "./messenger.service";
import type { MessengerEmitter } from "./messenger.emitter";
import type { NewMessageEvent, ReadEvent } from "@mingle/shared";
import { socketCorsOrigin } from "../common/socket-cors";

@WebSocketGateway({ cors: { origin: socketCorsOrigin() } })
export class MessengerGateway implements MessengerEmitter, OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    @Inject(forwardRef(() => MessengerService)) private readonly messenger: MessengerService,
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

  @SubscribeMessage("room:join")
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    if (!client.data.userId) return client.emit("messenger:error", { message: "forbidden" });
    const me = await this.messenger.assertMember(client.data.userId, body.roomId);
    if (me) client.join(body.roomId);
    else client.emit("messenger:error", { message: "forbidden" });
  }

  @SubscribeMessage("room:leave")
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    client.leave(body.roomId);
  }

  @SubscribeMessage("typing:start")
  async typingStart(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    await this.broadcastTyping(client, body.roomId, true);
  }

  @SubscribeMessage("typing:stop")
  async typingStop(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    await this.broadcastTyping(client, body.roomId, false);
  }

  private async broadcastTyping(client: Socket, roomId: string, isTyping: boolean) {
    if (!client.data.userId) return;
    const me = await this.messenger.assertMember(client.data.userId, roomId);
    if (!me) return;
    client.to(roomId).emit("typing", { roomId, profileId: me, isTyping });
  }

  emitNewMessage(event: NewMessageEvent): void {
    this.server.to(event.roomId).emit("message:new", event);
  }

  emitRead(event: ReadEvent): void {
    this.server.to(event.roomId).emit("message:read", event);
  }
}
