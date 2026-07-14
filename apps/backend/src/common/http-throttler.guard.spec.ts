import type { ExecutionContext } from "@nestjs/common";
import { HttpThrottlerGuard } from "./http-throttler.guard";

function makeContext(type: string): ExecutionContext {
  return {
    getType: () => type,
  } as unknown as ExecutionContext;
}

describe("HttpThrottlerGuard", () => {
  it("bypasses (returns true) immediately for non-http contexts (ws gateways)", async () => {
    const guard = Object.create(HttpThrottlerGuard.prototype) as HttpThrottlerGuard;
    const result = await guard.canActivate(makeContext("ws"));
    expect(result).toBe(true);
  });

  it("delegates to the base ThrottlerGuard for http contexts", async () => {
    const guard = Object.create(HttpThrottlerGuard.prototype) as HttpThrottlerGuard;
    const superCanActivate = jest.spyOn(
      Object.getPrototypeOf(HttpThrottlerGuard.prototype),
      "canActivate",
    );
    superCanActivate.mockResolvedValue(true);

    const result = await guard.canActivate(makeContext("http"));

    expect(superCanActivate).toHaveBeenCalled();
    expect(result).toBe(true);
    superCanActivate.mockRestore();
  });
});
