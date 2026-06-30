import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProposalService {
  constructor(private readonly prisma: PrismaService) {}
  // Phase 4: send/accept/decline → Match
}
