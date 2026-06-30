import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule {}
