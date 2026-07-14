import { throttleConfig } from "./throttle.config";

describe("throttleConfig", () => {
  it("empty env → defaults (ttl 60000, limit 120)", () => {
    expect(throttleConfig({})).toEqual({ ttl: 60000, limit: 120 });
  });

  it("valid overrides are honored", () => {
    expect(throttleConfig({ RATE_LIMIT_TTL_MS: "5000", RATE_LIMIT_MAX: "30" })).toEqual({
      ttl: 5000,
      limit: 30,
    });
  });

  it("NaN values fall back to defaults", () => {
    expect(throttleConfig({ RATE_LIMIT_TTL_MS: "abc", RATE_LIMIT_MAX: "xyz" })).toEqual({
      ttl: 60000,
      limit: 120,
    });
  });

  it("RATE_LIMIT_TTL_MS below floor (1000) falls back to default", () => {
    expect(throttleConfig({ RATE_LIMIT_TTL_MS: "500" })).toEqual({
      ttl: 60000,
      limit: 120,
    });
  });

  it("RATE_LIMIT_MAX below floor (5) falls back to default", () => {
    expect(throttleConfig({ RATE_LIMIT_MAX: "1" })).toEqual({
      ttl: 60000,
      limit: 120,
    });
  });

  it("RATE_LIMIT_TTL_MS exactly at floor (1000) is honored", () => {
    expect(throttleConfig({ RATE_LIMIT_TTL_MS: "1000" }).ttl).toBe(1000);
  });

  it("RATE_LIMIT_MAX exactly at floor (5) is honored", () => {
    expect(throttleConfig({ RATE_LIMIT_MAX: "5" }).limit).toBe(5);
  });
});
