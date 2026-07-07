import { IsBoolean } from "class-validator";

export class SetPushEnabledDto {
  @IsBoolean() pushEnabled!: boolean;
}
