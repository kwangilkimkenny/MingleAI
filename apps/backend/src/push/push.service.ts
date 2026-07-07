import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
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

  // undefined = not yet attempted, null = SDK failed to load, instance = ready
  private expoClient: Expo | null | undefined = undefined;
  private ExpoClass: typeof Expo | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Lazily loads expo-server-sdk on first use.
   *
   * expo-server-sdk@6 ships ESM-only. A top-level `require()` (from a static import
   * compiled to CommonJS) throws ERR_REQUIRE_ESM at module load, crashing the whole
   * NestJS process at boot — violating the invariant that push failures must be non-fatal.
   *
   * A lazy `import()` inside a try/catch defers loading to the first actual push attempt.
   * If it fails (ERR_REQUIRE_ESM on Node <20.19, or any other load error) the catch sets
   * `expoClient = null` and the service degrades to a no-op for the lifetime of the process.
   */
  private async ensureExpo(): Promise<boolean> {
    if (this.expoClient !== undefined) return this.expoClient !== null;
    try {
      const mod = await import("expo-server-sdk");
      this.ExpoClass = mod.Expo;
      this.expoClient = new mod.Expo({ accessToken: this.config.get<string>("EXPO_ACCESS_TOKEN") });
      return true;
    } catch (err) {
      this.log.warn(`expo-server-sdk failed to load — push disabled: ${err}`);
      this.expoClient = null;
      return false;
    }
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { pushEnabled: true } });
      if (!user || !user.pushEnabled) return;

      const rows = await this.prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
      if (!(await this.ensureExpo())) return;

      const tokens = rows.map((r) => r.token).filter((t) => this.ExpoClass!.isExpoPushToken(t));
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
    const chunks = this.expoClient!.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];
    for (const chunk of chunks) {
      tickets.push(...(await this.expoClient!.sendPushNotificationsAsync(chunk)));
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
