import { IsArray, IsEnum, IsString } from "class-validator";

export class CommunicationStyleDto {
  @IsEnum(["warm", "witty", "direct", "thoughtful", "playful"])
  tone!: string;

  @IsArray()
  @IsString({ each: true })
  topics!: string[];
}
