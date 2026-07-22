import { io } from "socket.io-client";
import { connectSpeedDateSocket, type SpeedDateSocketHandlers } from "@mingle/client-core";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export function openSpeedDateSocket(token: string, handlers: SpeedDateSocketHandlers) {
  return connectSpeedDateSocket({ ioFactory: io as never, baseUrl: BASE, token, handlers });
}
