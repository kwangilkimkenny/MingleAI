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
  location!: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  preferences!: {
    ageRange: { min: number; max: number };
    genderPreference: string[];
    locationRadius: number;
    dealbreakers?: string[];
  };

  values!: {
    relationshipGoal: string;
    lifestyle: string[];
    importantValues: string[];
  };

  communicationStyle!: {
    tone: string;
    topics: string[];
  };

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
