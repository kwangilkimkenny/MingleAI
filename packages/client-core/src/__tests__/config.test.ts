import { describe, it, expect, beforeEach } from "vitest";
import {
  configureClient,
  getClientConfig,
  setTokenAccessor,
  getToken,
} from "../config.js";

describe("config", () => {
  beforeEach(() => {
    configureClient({ baseUrl: "" });
    setTokenAccessor(() => null);
  });

  it("stores and returns the client config", () => {
    const onUnauthorized = () => {};
    configureClient({ baseUrl: "http://x", onUnauthorized });
    expect(getClientConfig().baseUrl).toBe("http://x");
    expect(getClientConfig().onUnauthorized).toBe(onUnauthorized);
  });

  it("defaults token to null and returns the injected token", () => {
    expect(getToken()).toBeNull();
    setTokenAccessor(() => "tok-123");
    expect(getToken()).toBe("tok-123");
  });
});
