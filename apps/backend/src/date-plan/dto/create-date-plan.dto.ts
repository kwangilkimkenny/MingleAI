import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
  IsDateString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class BudgetDto {
  @IsNumber()
  @Min(0)
  total!: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

class LocationDto {
  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  maxTravelMinutes?: number;

  /** 지도에서 고른 좌표 — 주면 코스에 실제 가게가 붙는다. */
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

class DateTimeDto {
  @IsDateString()
  preferredDate!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  durationHours?: number;
}

class PreferencesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisineTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activityTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  avoidTypes?: string[];
}

export class CreateDatePlanDto {
  @IsString()
  matchId!: string;

  @ValidateNested()
  @Type(() => BudgetDto)
  budget!: BudgetDto;

  @ValidateNested()
  @Type(() => LocationDto)
  location!: LocationDto;

  @ValidateNested()
  @Type(() => DateTimeDto)
  dateTime!: DateTimeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences?: PreferencesDto;
}
