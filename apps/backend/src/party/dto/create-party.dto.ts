import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
  Max,
} from "class-validator";

export class CreatePartyDto {
  @IsString()
  name!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(100)
  maxParticipants?: number;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  roundCount?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  roundDurationMinutes?: number;
}
