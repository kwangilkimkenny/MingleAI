import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Global `APP_GUARD` throttler that only applies to HTTP requests.
 *
 * The app also runs Socket.IO gateways (`MessengerGateway`, `SpeedDateGateway`); Nest's
 * `ThrottlerGuard` assumes an HTTP request/response pair (it reads/writes headers on the
 * response), which does not exist for a `ws` execution context and would throw. Bypass (return
 * `true`) for any non-http context so gateway message handlers are unaffected.
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") {
      return true;
    }
    return super.canActivate(context);
  }
}
