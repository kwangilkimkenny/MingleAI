import {
  IsString,
  IsInt,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
} from "class-validator";

export class CreateProfileDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(19)
  @Max(100)
  age!: number;

  @IsEnum(["male", "female", "non_binary", "prefer_not_to_say"])
  gender!: string;

  @IsString()
  @IsNotEmpty()
  occupation!: string;

  @IsString()
  @IsNotEmpty()
  partyPreferenceText!: string;

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
}
