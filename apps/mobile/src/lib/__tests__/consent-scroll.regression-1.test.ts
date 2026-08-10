import { describe, expect, it } from "vitest";

import { hasReachedConsentEnd } from "../consent-scroll";

describe("consent document read gate regression", () => {
  it("keeps consent locked before layout and content are measured", () => {
    expect(hasReachedConsentEnd({ layoutHeight: 0, contentHeight: 400, offsetY: 0 })).toBe(false);
    expect(hasReachedConsentEnd({ layoutHeight: 200, contentHeight: 0, offsetY: 0 })).toBe(false);
  });

  it("unlocks a document that fits entirely in its viewport", () => {
    expect(hasReachedConsentEnd({ layoutHeight: 220, contentHeight: 180, offsetY: 0 })).toBe(true);
  });

  it("unlocks only after a long document reaches its final threshold", () => {
    expect(hasReachedConsentEnd({ layoutHeight: 200, contentHeight: 600, offsetY: 350 })).toBe(false);
    expect(hasReachedConsentEnd({ layoutHeight: 200, contentHeight: 600, offsetY: 384 })).toBe(true);
  });

  it("does not let negative overscroll satisfy the gate", () => {
    expect(hasReachedConsentEnd({ layoutHeight: 200, contentHeight: 600, offsetY: -100 })).toBe(false);
  });
});
