import { IsIn } from "class-validator";

export class DeleteAccountDto {
  // Social-only accounts have no password; a valid session + typed confirmation authorizes deletion.
  @IsIn(["DELETE"])
  confirmation!: "DELETE";
}
