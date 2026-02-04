import { IsString, IsOptional, IsIn } from "class-validator";

export class GenerateReportDto {
  @IsString()
  partyId!: string;

  @IsString()
  profileId!: string;

  @IsOptional()
  @IsIn(["summary", "detailed"])
  reportType?: "summary" | "detailed";
}
