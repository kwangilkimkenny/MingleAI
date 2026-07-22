import { ArrayNotEmpty, IsArray, IsIn } from "class-validator";

export class ConsentDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(["terms", "privacy", "age19"], { each: true })
  scopes!: Array<"terms" | "privacy" | "age19">;
}
