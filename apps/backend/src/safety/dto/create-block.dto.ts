import { IsString, IsNotEmpty } from "class-validator";

export class CreateBlockDto {
  @IsString() @IsNotEmpty() blockedProfileId!: string;
}
