import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { throttleConfig } from "./common/throttle.config";
import { HttpThrottlerGuard } from "./common/http-throttler.guard";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { ProfileModule } from "./profile/profile.module";
import { PartyModule } from "./party/party.module";
import { SafetyModule } from "./safety/safety.module";
import { DatePlanModule } from "./date-plan/date-plan.module";
import { CacheConfigModule } from "./cache/cache.module";
import { NotificationModule } from "./notification/notification.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { AdminModule } from "./admin/admin.module";
import { MatchmakingModule } from "./matchmaking/matchmaking.module";
import { ProposalModule } from "./proposal/proposal.module";
import { MatchModule } from "./match/match.module";
import { SpeedDateModule } from "./speed-date/speed-date.module";
import { MessengerModule } from "./messenger/messenger.module";
import { UploadModule } from "./upload/upload.module";
import { validateEnvironment } from "./common/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([throttleConfig(process.env)]),
    CacheConfigModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    ProfileModule,
    PartyModule,
    SafetyModule,
    DatePlanModule,
    NotificationModule,
    DashboardModule,
    AdminModule,
    MatchmakingModule,
    ProposalModule,
    MatchModule,
    SpeedDateModule,
    MessengerModule,
    UploadModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: HttpThrottlerGuard,
    },
  ],
})
export class AppModule {}
