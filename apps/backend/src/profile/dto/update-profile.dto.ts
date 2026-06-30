import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  preferences?: {
    ageRange?: { min: number; max: number };
    genderPreference?: string[];
    locationRadius?: number;
    dealbreakers?: string[];
  };

  @IsOptional()
  values?: {
    relationshipGoal: string;
    lifestyle: string[];
    importantValues: string[];
  };

  @IsOptional()
  communicationStyle?: {
    tone: string;
    topics: string[];
  };

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
