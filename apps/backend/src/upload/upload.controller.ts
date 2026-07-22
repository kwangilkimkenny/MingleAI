import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { Request } from "express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

/**
 * Minimal shape of a multer memory-storage file. Declared locally so we don't
 * pull in `@types/multer` just for one field set (buffer/mimetype/size).
 */
export interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/** 5 MB — comfortably fits a phone photo downscaled by the client. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** On-disk directory served statically at /uploads/ (see main.ts useStaticAssets). */
export const UPLOADS_DIR = join(process.cwd(), "uploads");

/**
 * Sniff the leading magic bytes so a spoofed `Content-Type` can't smuggle a
 * non-image (or an executable renamed .png) past the gate. Returns the true
 * MIME, or null when the bytes match no supported image type.
 */
export function detectImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && // R
    buf[1] === 0x49 && // I
    buf[2] === 0x46 && // F
    buf[3] === 0x46 && // F
    buf[8] === 0x57 && // W
    buf[9] === 0x45 && // E
    buf[10] === 0x42 && // B
    buf[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

@ApiTags("Uploads")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("uploads")
export class UploadController {
  /**
   * Accept a single image (multipart field `file`), validate it by magic bytes,
   * persist it under uploads/ with a random name, and return its public URL.
   * Production always uses the validated PUBLIC_BASE_URL. Development may derive
   * the host from the request so a LAN device can reach the local backend.
   */
  @Post("photo")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
      required: ["file"],
    },
  })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadPhoto(
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: Request,
  ): Promise<{ url: string }> {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException("이미지 파일이 필요합니다.");
    }

    const mime = detectImageMime(file.buffer);
    const ext = mime ? MIME_TO_EXT[mime] : undefined;
    if (!ext) {
      throw new BadRequestException("JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.");
    }

    const filename = `${randomUUID()}.${ext}`;
    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(join(UPLOADS_DIR, filename), file.buffer);

    const configuredBase = process.env.PUBLIC_BASE_URL?.trim();
    if (process.env.NODE_ENV === "production" && !configuredBase) {
      throw new Error("PUBLIC_BASE_URL is required in production");
    }
    const base = configuredBase || `${req.protocol}://${req.get("host")}`;
    return { url: `${base}/uploads/${filename}` };
  }
}
