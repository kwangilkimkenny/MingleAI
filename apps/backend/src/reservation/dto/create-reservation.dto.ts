import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateReservationDto {
  @ApiProperty({ description: "파티 ID" })
  @IsString()
  @IsNotEmpty()
  partyId!: string;

  @ApiProperty({ description: "프로필 ID" })
  @IsString()
  @IsNotEmpty()
  profileId!: string;
}
