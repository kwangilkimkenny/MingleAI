import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { PartyService } from "./party.service";
import { CreatePartyDto } from "./dto/create-party.dto";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@ApiTags("Parties")
@Controller("parties")
export class PartyController {
  constructor(private partyService: PartyService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@Body() dto: CreatePartyDto) {
    return this.partyService.create(dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.partyService.findOne(id);
  }

  @Post(":id/participants")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  addParticipant(
    @Param("id") id: string,
    @Body() dto: AddParticipantDto,
  ) {
    return this.partyService.addParticipant(id, dto.profileId);
  }

  @Post(":id/run")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  run(@Param("id") id: string) {
    return this.partyService.run(id);
  }

  @Get(":id/results")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120_000)
  async getResults(@Param("id") id: string) {
    const party = await this.partyService.findOne(id);
    return { results: party.results };
  }
}
