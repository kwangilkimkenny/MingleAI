import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class ReportUserDto {
  @IsString()
  reportedProfileId!: string;

  @IsEnum([
    "harassment",
    "fraud",
    "fake_profile",
    "inappropriate_content",
    "spam",
    "other",
  ])
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;

  @IsOptional()
  @IsString()
  evidencePartyId?: string;
}
