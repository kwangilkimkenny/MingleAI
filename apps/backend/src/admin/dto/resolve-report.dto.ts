import { IsString, IsIn, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ResolveReportDto {
  @ApiProperty({ enum: ["resolved", "dismissed"] })
  @IsString()
  @IsIn(["resolved", "dismissed"])
  status!: "resolved" | "dismissed";

  @ApiPropertyOptional({ enum: ["warn", "suspend", "ban", "none"] })
  @IsString()
  @IsIn(["warn", "suspend", "ban", "none"])
  @IsOptional()
  action?: "warn" | "suspend" | "ban" | "none";

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
