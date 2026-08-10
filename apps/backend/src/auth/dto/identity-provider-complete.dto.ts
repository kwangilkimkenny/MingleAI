import { IsString, Matches, MaxLength } from "class-validator";

export class IdentityProviderCompleteDto {
  @IsString()
  @MaxLength(180)
  @Matches(/^mingles\.[A-Za-z0-9_-]+\.[a-f0-9]{24}\.[A-Za-z0-9_-]{24}$/)
  identityVerificationId!: string;
}
