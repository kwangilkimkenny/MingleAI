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
  profileId1!: string;

  @IsString()
  profileId2!: string;

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
