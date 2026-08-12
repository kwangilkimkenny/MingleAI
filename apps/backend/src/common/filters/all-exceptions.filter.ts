import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * 프레임워크가 만들어내는 영문 기본 메시지 → 한국어. 앱 UI는 서버 `message`를 그대로 노출하므로
 * (모바일 login/onboarding 등) 여기서 막지 않으면 "Not Found"·"Too many requests" 같은 영문이
 * 사용자에게 그대로 보인다(2026-07-27 버그). 서비스 코드가 직접 던진 한국어 메시지는 통과.
 */
const FRAMEWORK_MESSAGES: Record<string, string> = {
  "Bad Request": "요청 형식이 올바르지 않아요.",
  Unauthorized: "로그인이 필요해요.",
  Forbidden: "권한이 없어요.",
  "Not Found": "요청한 정보를 찾을 수 없어요.",
  "Method Not Allowed": "지원하지 않는 요청이에요.",
  "Request Timeout": "요청 시간이 초과됐어요. 다시 시도해 주세요.",
  Conflict: "이미 처리된 요청이에요.",
  "Payload Too Large": "파일이 너무 커요.",
  "Unsupported Media Type": "지원하지 않는 형식이에요.",
  "Unprocessable Entity": "요청 내용을 처리할 수 없어요.",
  "Too Many Requests": "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.",
  "ThrottlerException: Too many requests": "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.",
  "ThrottlerException: Too Many Requests": "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.",
  "Internal server error": "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
  "Service Unavailable": "서비스를 잠시 사용할 수 없어요.",
  "Gateway Timeout": "응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
};

/** 메시지를 못 알아볼 때 쓰는 상태코드 기준 문구. */
const STATUS_MESSAGES: Record<number, string> = {
  400: "요청 형식이 올바르지 않아요.",
  401: "로그인이 필요해요.",
  403: "권한이 없어요.",
  404: "요청한 정보를 찾을 수 없어요.",
  409: "이미 처리된 요청이에요.",
  413: "파일이 너무 커요.",
  429: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.",
  503: "서비스를 잠시 사용할 수 없어요.",
};
const DEFAULT_MESSAGE = "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";

/** 한글이 한 글자라도 있으면 서비스가 직접 쓴 문구로 보고 그대로 둔다. */
function hasKorean(s: string): boolean {
  return /[가-힣]/.test(s);
}

function localize(message: string | string[], status: number): {
  message: string;
  details?: string[];
} {
  // class-validator 배열(400) — 영문 필드 메시지는 details로 내리고 사용자 문구는 한국어로.
  if (Array.isArray(message)) {
    const korean = message.filter(hasKorean);
    if (korean.length > 0) return { message: korean.join("\n"), details: message };
    return { message: "입력한 내용을 다시 확인해 주세요.", details: message };
  }
  if (hasKorean(message)) return { message };
  const mapped = FRAMEWORK_MESSAGES[message];
  if (mapped) return { message: mapped, details: [message] };
  // 알 수 없는 영문 메시지(익스프레스 "Cannot GET …", 라이브러리 내부 등) — 상태코드 기준 문구로.
  return { message: STATUS_MESSAGES[status] ?? DEFAULT_MESSAGE, details: [message] };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let rawMessage: string | string[] = "Internal server error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      rawMessage =
        typeof exResponse === "string"
          ? exResponse
          : (exResponse as { message: string | string[] }).message ?? rawMessage;
    }

    const { message, details } = localize(rawMessage, status);

    this.log(request.method, request.url, status, response.getHeader("x-request-id"), exception);

    response.status(status).json({
      statusCode: status,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: response.getHeader("x-request-id"),
    });
  }

  /**
   * 상태코드별로 로그 레벨을 가른다.
   *
   * 예전엔 전부 `error`(+스택)였다. 그 결과 운영 로그가 인터넷 봇 스캔으로 도배됐다 —
   * `/.env`, `/.git/HEAD`, `/login.action`, `/@vite/env`, Jira·Exchange CVE 경로… 전부 404인데
   * ERROR로 찍혀서 **진짜 5xx가 그 속에 묻혔다**(2026-08-12 운영 로그 실측). 알림을 ERROR에
   * 걸면 100% 오탐이 된다.
   *
   * - 5xx: 우리 잘못이다 → error + 스택
   * - 4xx(404 제외): 클라이언트 잘못이다 → warn, 스택 없음(정상 흐름의 일부다)
   * - 404: 대부분 스캐너다 → verbose. 우리 클라의 오타 추적이 필요하면 로그 레벨을 낮춰서 본다.
   */
  private log(
    method: string,
    url: string,
    status: number,
    requestId: unknown,
    exception: unknown,
  ): void {
    // requestId는 응답 본문에도 실린다 — 사용자가 신고한 오류를 로그에서 바로 집어내려면 짝이 맞아야 한다.
    const line = `${method} ${url} ${status}${requestId ? ` [${String(requestId)}]` : ""}`;
    if (status >= 500) {
      this.logger.error(line, exception instanceof Error ? exception.stack : undefined);
      return;
    }
    if (status === HttpStatus.NOT_FOUND) {
      this.logger.verbose(line);
      return;
    }
    this.logger.warn(line);
  }
}
