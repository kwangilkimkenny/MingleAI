import { IsEnum, IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CheckContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;

  @IsEnum(["profile_bio", "conversation", "message", "report"])
  context!: string;
}
