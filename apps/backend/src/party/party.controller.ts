import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { PartyService } from "./party.service";
import { CreatePartyDto } from "./dto/create-party.dto";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@Controller("parties")
export class PartyController {
  constructor(private partyService: PartyService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePartyDto) {
    return this.partyService.create(dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.partyService.findOne(id);
  }

  @Post(":id/participants")
  @UseGuards(JwtAuthGuard)
  addParticipant(
    @Param("id") id: string,
    @Body() dto: AddParticipantDto,
  ) {
    return this.partyService.addParticipant(id, dto.profileId);
  }

  @Post(":id/run")
  @UseGuards(JwtAuthGuard)
  run(@Param("id") id: string) {
    return this.partyService.run(id);
  }

  @Get(":id/results")
  async getResults(@Param("id") id: string) {
    const party = await this.partyService.findOne(id);
    return { results: party.results };
  }
}
