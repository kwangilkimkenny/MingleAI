import {
  Controller,
  Get,
  Param,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { ApiTags } from "@nestjs/swagger";
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

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.partyService.findOne(id);
  }
}
