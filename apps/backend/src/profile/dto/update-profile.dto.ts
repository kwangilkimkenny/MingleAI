import {
  IsOptional,
  IsString,
  IsInt,
  IsEnum,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
} from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(19)
  @Max(100)
  age?: number;

  @IsOptional()
  @IsEnum(["male", "female", "non_binary", "prefer_not_to_say"])
  gender?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  partyPreferenceText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  interests?: unknown;

  @IsOptional()
  preferenceSignals?: unknown;
}
