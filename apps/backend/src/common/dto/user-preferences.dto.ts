import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class AgeRangeDto {
  @IsInt()
  @Min(19)
  min!: number;

  @IsInt()
  @Max(100)
  max!: number;
}

export class UserPreferencesDto {
  @ValidateNested()
  @Type(() => AgeRangeDto)
  ageRange!: AgeRangeDto;

  @IsArray()
  @IsEnum(["male", "female", "non_binary", "any"], { each: true })
  genderPreference!: string[];

  @IsNumber()
  @Min(1)
  locationRadius!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dealbreakers?: string[];
}
