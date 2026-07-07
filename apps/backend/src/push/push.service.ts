import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { PrismaService } from "../prisma/prisma.service";

export interface PushPayload {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);
  private readonly expo: Expo;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.expo = new Expo({ accessToken: config.get<string>("EXPO_ACCESS_TOKEN") });
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { pushEnabled: true } });
      if (!user || !user.pushEnabled) return;

      const rows = await this.prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
      const tokens = rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t));
      if (tokens.length === 0) return;

      const messages: ExpoPushMessage[] = tokens.map((to) => ({
        to,
        sound: "default",
        title: payload.title,
        body: payload.body,
        data: { type: payload.type, ...(payload.data ?? {}) },
      }));

      const tickets = await this.dispatch(messages);
      await this.prune(tokens, tickets);
    } catch (err) {
      this.log.warn(`push send failed for user ${userId}: ${err}`);
    }
  }

  /** Chunked send — split out so tests can stub the network. */
  private async dispatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];
    for (const chunk of chunks) {
      tickets.push(...(await this.expo.sendPushNotificationsAsync(chunk)));
    }
    return tickets;
  }

  /** Tickets are positional to `messages`, which are positional to `tokens`. */
  private async prune(tokens: string[], tickets: ExpoPushTicket[]): Promise<void> {
    await Promise.all(
      tickets.map((ticket, i) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          return this.prisma.deviceToken.deleteMany({ where: { token: tokens[i] } });
        }
        return undefined;
      }),
    );
  }
}
