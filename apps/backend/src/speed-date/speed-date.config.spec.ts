import { resolveAiFill } from "./speed-date.config";

describe("resolveAiFill — AI 참가자는 개발에서만", () => {
  const cfg = (env: Record<string, string | undefined>) => ({ get: (k: string) => env[k] });

  it("개발 환경에서는 env를 그대로 따른다", () => {
    expect(resolveAiFill(cfg({ SPEEDDATE_AI_FILL: "true", NODE_ENV: "development" }))).toBe(true);
    expect(resolveAiFill(cfg({ SPEEDDATE_AI_FILL: "false", NODE_ENV: "development" }))).toBe(false);
  });

  it("production에서는 켜달라고 해도 끈다(사람인 척하는 참가자 금지)", () => {
    const warned: string[] = [];
    expect(
      resolveAiFill(cfg({ SPEEDDATE_AI_FILL: "true", NODE_ENV: "production" }), (m) => warned.push(m)),
    ).toBe(false);
    expect(warned).toHaveLength(1);
  });

  it("기본값은 꺼짐", () => {
    expect(resolveAiFill(cfg({}))).toBe(false);
  });
});
