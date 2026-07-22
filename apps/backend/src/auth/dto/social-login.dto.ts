import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class SocialLoginDto {
  @IsIn(["kakao", "naver", "google"])
  provider!: "kakao" | "naver" | "google";

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  redirectUri!: string;

  // PKCE verifier (Kakao/Google) or OAuth state (Naver).
  @IsOptional()
  @IsString()
  @MaxLength(256)
  codeVerifier?: string;
}
