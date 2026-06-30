import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MatchmakingService {
  constructor(private readonly prisma: PrismaService) {}
  // Phase 2: queue enqueue/cancel + similarity grouping → party creation.
}
