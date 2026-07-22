import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Server-side hard gate for sensitive features (matching, speed date): requires a completed
 * real-name identity verification + privacy consent. Apply AFTER JwtAuthGuard. The onboarding/
 * consent/identity routes are NOT guarded (they are how a user clears this gate).
 */
@Injectable()
export class VerifiedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId = context.switchToHttp().getRequest()?.user?.userId as string | undefined;
    if (!userId) throw new ForbiddenException("인증이 필요합니다");

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phoneVerifiedAt: true },
    });
    if (!user?.phoneVerifiedAt) throw new ForbiddenException("본인인증이 필요합니다");

    const privacy = await this.prisma.consentGrant.findUnique({
      where: { userId_scope: { userId, scope: "privacy" } },
      select: { id: true },
    });
    if (!privacy) throw new ForbiddenException("개인정보 수집 동의가 필요합니다");

    return true;
  }
}
