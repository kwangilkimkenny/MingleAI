import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth.service";
import {
  GoogleProvider,
  KakaoProvider,
  NaverProvider,
  type SocialProfile,
  type SocialProvider,
} from "./social.provider";

@Injectable()
export class SocialAuthService {
  private readonly providers: Record<string, SocialProvider>;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {
    this.providers = {
      kakao: new KakaoProvider(config.get("KAKAO_CLIENT_ID"), config.get("KAKAO_CLIENT_SECRET")),
      naver: new NaverProvider(config.get("NAVER_CLIENT_ID"), config.get("NAVER_CLIENT_SECRET")),
      google: new GoogleProvider(config.get("GOOGLE_CLIENT_ID"), config.get("GOOGLE_CLIENT_SECRET")),
    };
  }

  /** Which providers are usable right now (keys present) — the client hides the rest. */
  configuredProviders(): string[] {
    return Object.values(this.providers)
      .filter((p) => p.isConfigured())
      .map((p) => p.name);
  }

  async login(providerName: string, code: string, redirectUri: string, codeVerifier?: string) {
    const provider = this.providers[providerName];
    if (!provider) throw new BadRequestException("지원하지 않는 로그인입니다");
    if (!provider.isConfigured()) throw new ServiceUnavailableException("현재 사용할 수 없는 로그인입니다");

    const profile = await provider.exchange(code, redirectUri, codeVerifier);
    if (!profile.providerId || profile.providerId === "undefined")
      throw new BadRequestException("소셜 계정 정보를 가져오지 못했습니다");

    const user = await this.findOrCreate(providerName, profile);
    return this.auth.issueSession(user.id, user.email, user.role);
  }

  private async findOrCreate(provider: string, profile: SocialProfile) {
    const existing = await this.prisma.user.findUnique({
      where: { authProvider_providerId: { authProvider: provider, providerId: profile.providerId } },
    });
    if (existing) return existing;

    // email is optional and unique — only attach it if free, so two providers sharing an email
    // don't collide (account identity is (provider, providerId), not email).
    let email: string | null = profile.email ? profile.email.trim().toLowerCase() : null;
    if (email && (await this.prisma.user.findUnique({ where: { email } }))) email = null;

    return this.prisma.user.create({
      data: { authProvider: provider, providerId: profile.providerId, email },
    });
  }
}
