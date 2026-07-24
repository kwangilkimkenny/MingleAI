import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { SocialAuthService } from "./social/social-auth.service";
import { IdentityService } from "./identity/identity.service";
import { ConsentService } from "./consent/consent.service";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { SocialLoginDto } from "./dto/social-login.dto";
import { DevLoginDto } from "./dto/dev-login.dto";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { ConsentDto } from "./dto/consent.dto";
import { IdentityCompleteDto } from "./dto/identity-complete.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, type JwtPayload } from "../common/decorators/current-user.decorator";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly social: SocialAuthService,
    private readonly identity: IdentityService,
    private readonly consent: ConsentService,
    private readonly config: ConfigService,
  ) {}

  // ── Social login (consumer auth) ─────────────────────────────────────────
  @Get("social/providers")
  socialProviders() {
    return { providers: this.social.configuredProviders() };
  }

  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post("social")
  socialLogin(@Body() dto: SocialLoginDto) {
    return this.social.login(dto.provider, dto.code, dto.redirectUri, dto.codeVerifier);
  }

  // ── Dev/CI/admin login (never in prod) ───────────────────────────────────
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post("dev-login")
  devLogin(@Body() dto: DevLoginDto) {
    if (this.config.get("DEV_AUTH_ENABLED") !== "true") throw new NotFoundException();
    return this.authService.devLogin(dto.email, dto.role);
  }

  // ── Admin console login (prod-capable; disabled unless ADMIN_* env set) ───
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post("admin-login")
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto.email, dto.password);
  }

  // ── Session lifecycle ────────────────────────────────────────────────────
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }

  @Post("logout-all")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: JwtPayload) {
    await this.authService.revokeAll(user.userId);
  }

  @Delete("account")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: JwtPayload, @Body() _dto: DeleteAccountDto) {
    await this.authService.deleteAccount(user.userId);
  }

  // ── Onboarding gate: consent → identity ──────────────────────────────────
  @Get("account-status")
  @UseGuards(JwtAuthGuard)
  accountStatus(@CurrentUser() user: JwtPayload) {
    return this.consent.getAccountStatus(user.userId);
  }

  @Post("consent")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async submitConsent(@CurrentUser() user: JwtPayload, @Body() dto: ConsentDto) {
    await this.consent.submit(user.userId, dto.scopes);
  }

  @Post("identity/start")
  @UseGuards(JwtAuthGuard)
  startIdentity() {
    return this.identity.start();
  }

  @Post("identity/complete")
  @UseGuards(JwtAuthGuard)
  completeIdentity(@CurrentUser() user: JwtPayload, @Body() dto: IdentityCompleteDto) {
    return this.identity.complete(user.userId, dto);
  }
}
