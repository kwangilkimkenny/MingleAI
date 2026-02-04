import { IsArray, IsEnum, IsString } from "class-validator";

export class UserValuesDto {
  @IsEnum(["casual", "dating", "serious", "marriage"])
  relationshipGoal!: string;

  @IsArray()
  @IsString({ each: true })
  lifestyle!: string[];

  @IsArray()
  @IsString({ each: true })
  importantValues!: string[];
}
