import { IsEnum, IsString } from "class-validator";

export class CheckContentDto {
  @IsString()
  content!: string;

  @IsEnum(["profile_bio", "conversation", "message", "report"])
  context!: string;
}
