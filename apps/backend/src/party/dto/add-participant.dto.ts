import { IsString } from "class-validator";

export class AddParticipantDto {
  @IsString()
  profileId!: string;
}
