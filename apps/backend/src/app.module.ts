import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { ProfileModule } from "./profile/profile.module";
import { PartyModule } from "./party/party.module";
import { ReportModule } from "./report/report.module";
import { SafetyModule } from "./safety/safety.module";
import { DatePlanModule } from "./date-plan/date-plan.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ProfileModule,
    PartyModule,
    ReportModule,
    SafetyModule,
    DatePlanModule,
  ],
})
export class AppModule {}
