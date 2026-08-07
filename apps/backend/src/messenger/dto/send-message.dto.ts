import { IsString, IsOptional, MaxLength } from "class-validator";

export class SendMessageDto {
  /** 이미지만 보낼 때는 빈 문자열이 온다 — 둘 다 비면 서비스가 400. */
  @IsString() @MaxLength(2000) content!: string;

  /** 첨부 이미지 URL. `POST /uploads/photo`가 돌려준 우리 도메인 경로만 허용된다. */
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
}
