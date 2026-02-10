import { IsString, IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ["active", "suspended"] })
  @IsString()
  @IsIn(["active", "suspended"])
  status!: "active" | "suspended";
}
