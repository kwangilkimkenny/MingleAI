import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ActiveAccount {
  userId: string;
  email: string;
  role: string;
}

/** Single source of truth for account-level access across HTTP and WebSockets. */
@Injectable()
export class AccountAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(userId: string): Promise<ActiveAccount | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        profile: { select: { status: true } },
      },
    });
    if (!user || (user.profile && user.profile.status !== "active")) return null;
    return { userId: user.id, email: user.email, role: user.role };
  }

  async requireActive(userId: string): Promise<ActiveAccount> {
    const account = await this.findActive(userId);
    if (!account) throw new UnauthorizedException("사용할 수 없는 계정입니다");
    return account;
  }
}
