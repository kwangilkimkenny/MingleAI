import { io } from "socket.io-client";
import { connectPartySocket, type PartySocketHandlers } from "@mingle/client-core";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export function openPartySocket(token: string, handlers: PartySocketHandlers) {
  return connectPartySocket({ ioFactory: io as never, baseUrl: BASE, token, handlers });
}
