import { Type } from "class-transformer";
import { PreferenceAnswersDto } from "./create-profile.dto";
import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsUrl,
  IsArray,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  ValidateNested,
} from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  // age·gender는 본인인증이 진실이라 수정 불가(2026-08-11 제거). 보내면 whitelist가 400으로 막는다.

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

  /** 구조화 선호 — 오면 신호·요약문을 서버가 다시 만든다(2026-08-06). */
  @IsOptional()
  @ValidateNested()
  @Type(() => PreferenceAnswersDto)
  preferences?: PreferenceAnswersDto;

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
