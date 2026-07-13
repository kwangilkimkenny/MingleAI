import {
  IsOptional,
  IsString,
  IsInt,
  IsEnum,
  IsNotEmpty,
  IsUrl,
  IsArray,
  Min,
  Max,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
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
  @IsNotEmpty()
  @MaxLength(120)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  partyPreferenceText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  // require_tld:false so photos served from the dev backend (localhost / LAN IP,
  // no TLD) validate; the /uploads/<uuid> URL stays short (well under 500).
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(500)
  photoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  @MaxLength(40, { each: true })
  interests?: string[];
}
