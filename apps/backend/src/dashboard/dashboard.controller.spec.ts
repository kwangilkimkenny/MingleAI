import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";

const dashboardService = { getSummary: jest.fn(), getMyParties: jest.fn() } as any;
const profileService = { findByUserId: jest.fn() } as any;
const controller = new DashboardController(dashboardService, profileService);

const USER = { userId: "u1" } as any;
beforeEach(() => jest.clearAllMocks());

describe("DashboardController IDOR guard", () => {
  it("getSummary derives profileId from the JWT (ignores absent query param)", async () => {
    profileService.findByUserId.mockResolvedValue({ id: "mine" });
    dashboardService.getSummary.mockResolvedValue({ profileId: "mine" });
    await controller.getSummary(USER, undefined);
    expect(profileService.findByUserId).toHaveBeenCalledWith("u1");
    expect(dashboardService.getSummary).toHaveBeenCalledWith("mine");
  });

  it("getSummary allows a query profileId that matches the caller's own profile", async () => {
    profileService.findByUserId.mockResolvedValue({ id: "mine" });
    await controller.getSummary(USER, "mine");
    expect(dashboardService.getSummary).toHaveBeenCalledWith("mine");
  });

  it("getSummary rejects a query profileId belonging to someone else (403)", async () => {
    profileService.findByUserId.mockResolvedValue({ id: "mine" });
    await expect(controller.getSummary(USER, "victim")).rejects.toBeInstanceOf(ForbiddenException);
    expect(dashboardService.getSummary).not.toHaveBeenCalled();
  });

  it("getMyParties rejects another profile's id (403)", async () => {
    profileService.findByUserId.mockResolvedValue({ id: "mine" });
    await expect(controller.getMyParties(USER, "victim")).rejects.toBeInstanceOf(ForbiddenException);
    expect(dashboardService.getMyParties).not.toHaveBeenCalled();
  });

  it("getMyParties uses the caller's own id and forwards pagination", async () => {
    profileService.findByUserId.mockResolvedValue({ id: "mine" });
    await controller.getMyParties(USER, "mine", "5", "10");
    expect(dashboardService.getMyParties).toHaveBeenCalledWith("mine", 5, 10);
  });

  it("throws 404 when the caller has no profile", async () => {
    profileService.findByUserId.mockResolvedValue(null);
    await expect(controller.getSummary(USER, undefined)).rejects.toBeInstanceOf(NotFoundException);
  });
});
