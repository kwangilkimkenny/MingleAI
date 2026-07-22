import { IsEmail, IsIn, IsOptional } from "class-validator";

export class DevLoginDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(["user", "admin", "super_admin"])
  role?: string;
}
