import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { AccountAccessService } from "./account-access.service";
import { SocialAuthService } from "./social/social-auth.service";
import { IdentityService } from "./identity/identity.service";
import { ConsentService } from "./consent/consent.service";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: { expiresIn: "1h" },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountAccessService,
    JwtStrategy,
    SocialAuthService,
    IdentityService,
    ConsentService,
  ],
  exports: [AuthService, AccountAccessService, JwtModule],
})
export class AuthModule {}
