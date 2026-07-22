import { ForbiddenException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";

jest.mock("bcrypt");

describe("AuthService account deletion regression", () => {
  it("returns 403 without deleting data when the confirmation password is wrong", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user-1",
          passwordHash: "hashed-password",
          profile: null,
        }),
      },
      $transaction: jest.fn(),
    };
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const service = new AuthService(
      prisma as never,
      { sign: jest.fn() } as never,
      { requireActive: jest.fn() } as never,
    );

    // Regression: ISSUE-007 — wrong deletion password was treated as an expired session
    // Found by /qa on 2026-07-22
    // Report: .gstack/qa-reports/qa-report-localhost-2026-07-22.md
    await expect(service.deleteAccount("user-1", "wrong-password")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
