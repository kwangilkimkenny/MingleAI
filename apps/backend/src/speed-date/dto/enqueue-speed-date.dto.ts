import { IsBoolean } from "class-validator";

export class EnqueueSpeedDateDto {
  /** Explicit consent to the blind-date mode (voice/video, progressive face reveal). */
  @IsBoolean()
  consent!: boolean;
}
