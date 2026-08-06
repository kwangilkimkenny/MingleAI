import { Type } from "class-transformer";
import {
  IsString,
  IsInt,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  IsUrl,
  IsArray,
  Min,
  Max,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
} from "class-validator";
import {
  ACTIVITY_OPTIONS,
  MAX_ACTIVITIES,
  MAX_NOTE_LENGTH,
  MIN_ACTIVITIES,
} from "@mingle/shared";

const ACTIVITY_VALUES = ACTIVITY_OPTIONS.map((o) => o.value);

/** 온보딩 구조화 선호 — 선택지가 곧 매칭 축(vibe·pace·drinking·activity). */
export class PreferenceAnswersDto {
  @IsEnum(["calm", "balanced", "energetic"])
  vibe!: "calm" | "balanced" | "energetic";

  @IsEnum(["slow", "medium", "fast"])
  pace!: "slow" | "medium" | "fast";

  @IsEnum(["none", "light", "social"])
  drinking!: "none" | "light" | "social";

  @IsArray()
  @ArrayMinSize(MIN_ACTIVITIES)
  @ArrayMaxSize(MAX_ACTIVITIES)
  @IsEnum(ACTIVITY_VALUES, { each: true })
  activities!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;
}

export class CreateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  /** 본인인증 완료 계정은 verified 값이 권위 — 생략 가능. 미인증(레거시/테스트)만 필수. */
  @IsOptional()
  @IsInt()
  @Min(19)
  @Max(100)
  age?: number;

  @IsOptional()
  @IsEnum(["male", "female", "non_binary", "prefer_not_to_say"])
  gender?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  occupation!: string;

  /** 레거시 자유서술 — 구조화 `preferences`를 보내면 서버가 생성하므로 생략 가능. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(1000)
  partyPreferenceText?: string;

  /** 온보딩 구조화 선호(2026-08-06) — 선택지가 곧 매칭 신호가 된다. */
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
