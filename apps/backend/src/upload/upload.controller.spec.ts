import { BadRequestException } from "@nestjs/common";
import type { Request } from "express";
import * as fsp from "fs/promises";
import { UploadController, detectImageMime, type UploadedImageFile } from "./upload.controller";

jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

const mockedFsp = jest.mocked(fsp);

const req = { protocol: "http", get: () => "localhost:3000" } as unknown as Request;

function fileOf(bytes: number[], mimetype: string): UploadedImageFile {
  const buffer = Buffer.from(bytes);
  return { buffer, mimetype, originalname: "x", size: buffer.length };
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

describe("detectImageMime", () => {
  it("recognizes PNG / JPEG / WEBP magic bytes", () => {
    expect(detectImageMime(Buffer.from(PNG))).toBe("image/png");
    expect(detectImageMime(Buffer.from(JPEG))).toBe("image/jpeg");
    expect(detectImageMime(Buffer.from(WEBP))).toBe("image/webp");
  });

  it("returns null for non-image bytes", () => {
    expect(detectImageMime(Buffer.from("not an image at all"))).toBeNull();
    expect(detectImageMime(Buffer.from([0x00, 0x01]))).toBeNull();
  });
});

describe("UploadController", () => {
  let controller: UploadController;

  beforeEach(() => {
    controller = new UploadController();
    mockedFsp.mkdir.mockClear();
    mockedFsp.writeFile.mockClear();
    delete process.env.PUBLIC_BASE_URL;
  });

  it("rejects a missing file", async () => {
    await expect(controller.uploadPhoto(undefined, req)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockedFsp.writeFile).not.toHaveBeenCalled();
  });

  it("rejects an empty file", async () => {
    const empty: UploadedImageFile = {
      buffer: Buffer.alloc(0),
      mimetype: "image/png",
      originalname: "x",
      size: 0,
    };
    await expect(controller.uploadPhoto(empty, req)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a spoofed mimetype whose bytes are not an image", async () => {
    const spoof = fileOf([0x25, 0x50, 0x44, 0x46], "image/png"); // %PDF
    await expect(controller.uploadPhoto(spoof, req)).rejects.toBeInstanceOf(BadRequestException);
    expect(mockedFsp.writeFile).not.toHaveBeenCalled();
  });

  it("accepts a valid PNG and returns a request-derived /uploads URL", async () => {
    const res = await controller.uploadPhoto(fileOf(PNG, "image/png"), req);
    expect(res.url).toMatch(/^http:\/\/localhost:3000\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(mockedFsp.mkdir).toHaveBeenCalledTimes(1);
    expect(mockedFsp.writeFile).toHaveBeenCalledTimes(1);
  });

  it("maps JPEG and WEBP to their extensions", async () => {
    const jpg = await controller.uploadPhoto(fileOf(JPEG, "image/jpeg"), req);
    expect(jpg.url).toMatch(/\.jpg$/);
    const webp = await controller.uploadPhoto(fileOf(WEBP, "image/webp"), req);
    expect(webp.url).toMatch(/\.webp$/);
  });

  it("honors PUBLIC_BASE_URL over the request host", async () => {
    process.env.PUBLIC_BASE_URL = "https://cdn.example.com";
    const res = await controller.uploadPhoto(fileOf(PNG, "image/png"), req);
    expect(res.url).toMatch(/^https:\/\/cdn\.example\.com\/uploads\/[0-9a-f-]{36}\.png$/);
  });
});
