import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;

  @IsIn(["DELETE"])
  confirmation!: "DELETE";
}
