import { Controller, Post, Get, Body, Param, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtPayload } from "../common/decorators/current-user.decorator";
import { ProposalService } from "./proposal.service";
import { SendProposalDto } from "./dto/send-proposal.dto";

@Controller("proposals")
@UseGuards(JwtAuthGuard)
export class ProposalController {
  constructor(private readonly proposals: ProposalService) {}

  @Post()
  send(@CurrentUser() user: JwtPayload, @Body() dto: SendProposalDto) {
    return this.proposals.send(user.userId, dto.partyId, dto.toProfileId);
  }

  @Get("received")
  received(@CurrentUser() user: JwtPayload) {
    return this.proposals.listReceived(user.userId);
  }

  @Get("sent")
  sent(@CurrentUser() user: JwtPayload) {
    return this.proposals.listSent(user.userId);
  }

  @Post(":id/decline")
  @HttpCode(HttpStatus.NO_CONTENT)
  decline(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.proposals.decline(user.userId, id);
  }
}
