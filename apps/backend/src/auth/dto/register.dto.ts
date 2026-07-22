import { Equals, IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @Equals(true, { message: "이용약관과 개인정보 처리방침 동의가 필요합니다" })
  legalAccepted!: true;
}
