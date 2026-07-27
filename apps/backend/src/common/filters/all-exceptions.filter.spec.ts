import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";

/** Minimal ArgumentsHost double capturing the JSON body the filter writes. */
function hostFor(): { host: any; body: () => any } {
  let payload: any;
  const response = {
    status: () => response,
    json: (b: any) => {
      payload = b;
      return response;
    },
    getHeader: () => "req-1",
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: "GET", url: "/x" }),
    }),
  };
  return { host, body: () => payload };
}

function run(exception: unknown): any {
  const { host, body } = hostFor();
  new AllExceptionsFilter().catch(exception, host);
  return body();
}

describe("AllExceptionsFilter Korean messages", () => {
  it("translates framework English defaults", () => {
    expect(run(new NotFoundException()).message).toBe("요청한 정보를 찾을 수 없어요.");
    expect(run(new ForbiddenException()).message).toBe("권한이 없어요.");
    expect(
      run(new HttpException("ThrottlerException: Too Many Requests", HttpStatus.TOO_MANY_REQUESTS))
        .message,
    ).toBe("요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.");
  });

  it("keeps service-authored Korean messages untouched", () => {
    const res = run(new ServiceUnavailableException("네이버 검색이 설정되지 않았습니다"));
    expect(res.message).toBe("네이버 검색이 설정되지 않았습니다");
    expect(res.details).toBeUndefined();
  });

  it("replaces class-validator English arrays with one Korean line, keeping details", () => {
    const res = run(new BadRequestException(["email must be an email"]));
    expect(res.message).toBe("입력한 내용을 다시 확인해 주세요.");
    expect(res.details).toEqual(["email must be an email"]);
  });

  it("falls back by status code for unknown English text", () => {
    const res = run(new NotFoundException("Cannot GET /auth/nope"));
    expect(res.message).toBe("요청한 정보를 찾을 수 없어요.");
    expect(res.details).toEqual(["Cannot GET /auth/nope"]);
  });

  it("never leaks a raw non-HTTP error", () => {
    const res = run(new Error("boom: sqlite disk image is malformed"));
    expect(res.statusCode).toBe(500);
    expect(res.message).toBe("일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
  });
});
