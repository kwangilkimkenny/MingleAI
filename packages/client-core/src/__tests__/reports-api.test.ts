import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../api/client.js";
import { reportUser, REPORT_REASONS } from "../index.js";

const fetchMock = vi.spyOn(client, "apiFetch").mockResolvedValue(undefined as never);
beforeEach(() => fetchMock.mockClear());

describe("reports API", () => {
  it("reportUser POSTs the full input", async () => {
    await reportUser({
      reportedProfileId: "p2",
      reason: "harassment",
      details: "욕설",
      evidencePartyId: "party1",
    });
    expect(fetchMock).toHaveBeenCalledWith("/safety/report", {
      method: "POST",
      body: JSON.stringify({
        reportedProfileId: "p2",
        reason: "harassment",
        details: "욕설",
        evidencePartyId: "party1",
      }),
    });
  });

  it("reportUser POSTs with only the required fields", async () => {
    await reportUser({ reportedProfileId: "p2", reason: "spam" });
    expect(fetchMock).toHaveBeenCalledWith("/safety/report", {
      method: "POST",
      body: JSON.stringify({ reportedProfileId: "p2", reason: "spam" }),
    });
  });

  it("REPORT_REASONS lists exactly the six backend reasons in order", () => {
    expect(REPORT_REASONS).toEqual([
      "harassment",
      "fraud",
      "fake_profile",
      "inappropriate_content",
      "spam",
      "other",
    ]);
  });
});
