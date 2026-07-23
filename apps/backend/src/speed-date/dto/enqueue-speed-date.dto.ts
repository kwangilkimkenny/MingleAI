import { IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";

/** Optional geo for radius-based blind-date matching. All fields optional (location is opt-in). */
export class EnqueueSpeedDateDto {
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

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  radiusKm?: number;
}
