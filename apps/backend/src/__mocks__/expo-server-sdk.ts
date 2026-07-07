/**
 * Jest manual mock for expo-server-sdk.
 *
 * expo-server-sdk ships as ESM-only ("type":"module"), which is incompatible with
 * Jest's default CommonJS transform.  This lightweight mock provides every API
 * surface that PushService uses so tests don't need the real package to load.
 *
 * The real integration relies on Expo infra that cannot be exercised in unit tests
 * anyway; all network I/O goes through the `dispatch` method which test spies stub.
 */

export class Expo {
  /** Same heuristic the real SDK uses (token starts with "ExponentPushToken["). */
  static isExpoPushToken(token: unknown): boolean {
    return typeof token === "string" && /^ExponentPushToken\[/.test(token);
  }

  constructor(_options?: { accessToken?: string }) {}

  chunkPushNotifications(messages: any[]): any[][] {
    // Return as a single chunk — fine for unit tests.
    return [messages];
  }

  async sendPushNotificationsAsync(chunk: any[]): Promise<any[]> {
    return chunk.map(() => ({ status: "ok" }));
  }
}

// Type aliases used in push.service.ts imports.
export type ExpoPushMessage = {
  to: string;
  sound?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};
export type ExpoPushTicket = { status: "ok" } | { status: "error"; details?: { error?: string }; message: string };
