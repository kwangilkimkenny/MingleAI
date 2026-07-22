import { IsDateString, IsIn, IsString, Matches, MaxLength, MinLength } from "class-validator";

/** Dev-bypass identity payload. Real 본인인증 delivers these server-to-server from the provider. */
export class IdentityCompleteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsDateString()
  birth!: string; // YYYY-MM-DD

  @IsIn(["male", "female"])
  gender!: "male" | "female";

  @Matches(/^[0-9+\-]{7,20}$/)
  phone!: string;
}
