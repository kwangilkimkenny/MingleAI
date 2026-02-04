import { IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import {
  UserPreferencesDto,
  UserValuesDto,
  CommunicationStyleDto,
} from "../../common/dto";

export class UpdateProfileDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  preferences?: UserPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserValuesDto)
  values?: UserValuesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CommunicationStyleDto)
  communicationStyle?: CommunicationStyleDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
