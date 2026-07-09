import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, type JwtPayload } from "../common/decorators/current-user.decorator";
import { PartyService } from "./party.service";

@ApiTags("Parties")
@Controller("parties")
export class PartyController {
  constructor(private partyService: PartyService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30_000)
  findAll(
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.partyService.findAll({
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(":id/messages")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMessages(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const me = await this.partyService.assertParticipant(user.userId, id);
    if (!me) throw new ForbiddenException("파티 참가자가 아닙니다");
    return this.partyService.getPartyMessages(id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.partyService.findOne(id);
  }
}
