import { socketCorsOrigin } from "./socket-cors";

describe("socketCorsOrigin", () => {
  it("reflects any origin (true) when unset/empty/whitespace", () => {
    expect(socketCorsOrigin(undefined)).toBe(true);
    expect(socketCorsOrigin("")).toBe(true);
    expect(socketCorsOrigin("   ")).toBe(true);
    expect(socketCorsOrigin(",  ,")).toBe(true);
  });
  it("parses a comma-separated allowlist, trimming blanks", () => {
    expect(socketCorsOrigin("https://a.example, https://b.example ,")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });
  it("single origin → one-element allowlist", () => {
    expect(socketCorsOrigin("https://only.example")).toEqual(["https://only.example"]);
  });
});
