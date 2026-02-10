import { IsString, IsInt, IsOptional, Min, IsDateString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdatePartyDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(2)
  @IsOptional()
  maxParticipants?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  theme?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(18)
  @IsOptional()
  ageMin?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  ageMax?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;
}
