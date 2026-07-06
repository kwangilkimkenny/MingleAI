import { IsString, IsNotEmpty } from "class-validator";

export class SendProposalDto {
  @IsString() @IsNotEmpty() partyId!: string;
  @IsString() @IsNotEmpty() toProfileId!: string;
}
