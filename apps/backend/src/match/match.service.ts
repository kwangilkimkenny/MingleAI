import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MatchService {
  constructor(private readonly prisma: PrismaService) {}
  // Phase 4: create from accepted proposal, open DM room
}
