import {
  IsString,
  IsInt,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  UserPreferencesDto,
  UserValuesDto,
  CommunicationStyleDto,
} from "../../common/dto";

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

  @ValidateNested()
  @Type(() => UserPreferencesDto)
  preferences!: UserPreferencesDto;

  @ValidateNested()
  @Type(() => UserValuesDto)
  values!: UserValuesDto;

  @ValidateNested()
  @Type(() => CommunicationStyleDto)
  communicationStyle!: CommunicationStyleDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
