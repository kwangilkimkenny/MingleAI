import { JwtService } from "@nestjs/jwt";
import type { Server, Socket } from "socket.io";
import { AccountAccessService } from "../auth/account-access.service";

/**
 * Socket.IO auth middleware. Runs during the handshake — BEFORE the "connection" event and
 * before ANY message events — so `socket.data.userId` is guaranteed set by the time handlers run.
 *
 * This closes a race: authenticating inside an async `handleConnection` sets `socket.data.userId`
 * only AFTER an `await` (a DB lookup), but Socket.IO fires the client "connect" event on transport
 * connection. A client that emits an authed event immediately after connect (e.g. `party:join`, or
 * the auto-rejoin on reconnect) could reach the handler before auth completed → treated as
 * unauthenticated → rejected, and the join silently dropped. Middleware eliminates that window.
 *
 * Rejects connections with a missing/invalid token or inactive account (client sees connect_error).
 */
export function socketAuthMiddleware(jwt: JwtService, accountAccess: AccountAccessService) {
  return async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("unauthorized"));
      const payload = jwt.verify(token) as { sub: string };
      const account = await accountAccess.findActive(payload.sub);
      if (!account) return next(new Error("unauthorized"));
      socket.data.userId = account.userId;
      socket.data.role = account.role;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  };
}

/** Register the auth middleware on a gateway's server (call from `afterInit`). */
export function applySocketAuth(server: Server, jwt: JwtService, accountAccess: AccountAccessService) {
  server.use(socketAuthMiddleware(jwt, accountAccess));
}
