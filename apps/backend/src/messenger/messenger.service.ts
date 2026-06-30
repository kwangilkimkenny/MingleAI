import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MessengerService {
  constructor(private readonly prisma: PrismaService) {}
  // Phase 4: 1:1 direct messages
}
