import { io } from "socket.io-client";
import { connectMessengerSocket, type MessengerSocketHandlers } from "@mingle/client-core";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export function openMessengerSocket(token: string, handlers: MessengerSocketHandlers) {
  return connectMessengerSocket({ ioFactory: io as never, baseUrl: BASE, token, handlers });
}
