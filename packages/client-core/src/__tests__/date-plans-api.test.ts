import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../api/client.js";
import {
  createDatePlan,
  getDatePlan,
  getDatePlansForMatch,
  selectCourse,
  confirmDatePlan,
  cancelDatePlan,
} from "../index.js";

const fetchMock = vi.spyOn(client, "apiFetch").mockResolvedValue(undefined as never);
beforeEach(() => fetchMock.mockClear());
const INPUT = {
  matchId: "m1",
  budget: { total: 100000 },
  location: { city: "서울" },
  dateTime: { preferredDate: "2026-08-01" },
};

describe("date-plans API", () => {
  it("createDatePlan POSTs the input", async () => {
    await createDatePlan(INPUT as any);
    expect(fetchMock).toHaveBeenCalledWith("/date-plans", { method: "POST", body: JSON.stringify(INPUT) });
  });
  it("getDatePlan GETs by id", async () => {
    await getDatePlan("d1");
    expect(fetchMock).toHaveBeenCalledWith("/date-plans/d1");
  });
  it("getDatePlansForMatch GETs by matchId query", async () => {
    await getDatePlansForMatch("m1");
    expect(fetchMock).toHaveBeenCalledWith("/date-plans?matchId=m1");
  });
  it("selectCourse PATCHes select", async () => {
    await selectCourse("d1", "c1");
    expect(fetchMock).toHaveBeenCalledWith("/date-plans/d1/select", {
      method: "PATCH",
      body: JSON.stringify({ courseId: "c1" }),
    });
  });
  it("confirmDatePlan PATCHes confirm", async () => {
    await confirmDatePlan("d1");
    expect(fetchMock).toHaveBeenCalledWith("/date-plans/d1/confirm", { method: "PATCH" });
  });
  it("cancelDatePlan PATCHes cancel", async () => {
    await cancelDatePlan("d1");
    expect(fetchMock).toHaveBeenCalledWith("/date-plans/d1/cancel", { method: "PATCH" });
  });
});
