import { ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { IdentityProvider, IdentityStart, VerifiedIdentity } from "./identity-provider";

/**
 * NICE 휴대폰본인확인 — **계약 대기 중이라 아직 비어 있다.**
 *
 * 왜 미리 채우지 않았나: NICE 표준창 규격(암호화 토큰 발급 → AES 요청 암호화 → 콜백 복호화)은
 * 계약 후 받는 `client_id`/`client_secret`과 상품별 문서에 따라 필드가 달라진다. 실 키 없이는
 * 한 줄도 검증할 수 없고, 검증 못 한 인증 코드는 있는 것보다 없는 게 낫다 —
 * "동작하는 것처럼 보이는 본인인증"이 제일 위험하다.
 *
 * 계약 후 채울 것(이 파일만 고치면 된다):
 *  1. 접근토큰: client_id/secret Basic 인증으로 access_token 발급
 *  2. 암호화 토큰 요청 → 응답으로 key/iv/hmac 파생
 *  3. `start()`: 요청 데이터를 AES 암호화해 `encData`/`integrityValue` 생성, returnUrl 포함
 *  4. `verify()`: 콜백 enc_data 복호화 → 이름·생년월일·성별·휴대폰·CI·DI 추출
 *     (성별 코드 매핑, 생년월일 포맷 YYYYMMDD → YYYY-MM-DD 변환 주의)
 *
 * 필요한 env: `NICE_CLIENT_ID`, `NICE_CLIENT_SECRET`, `NICE_PRODUCT_ID`, `NICE_RETURN_URL`
 */
export class NiceIdentityProvider implements IdentityProvider {
  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(
      this.config.get<string>("NICE_CLIENT_ID") &&
        this.config.get<string>("NICE_CLIENT_SECRET") &&
        this.config.get<string>("NICE_PRODUCT_ID") &&
        this.config.get<string>("NICE_RETURN_URL"),
    );
  }

  start(): Promise<IdentityStart> {
    return Promise.reject(this.notImplemented());
  }

  verify(): Promise<VerifiedIdentity> {
    return Promise.reject(this.notImplemented());
  }

  /** env는 채워졌는데 코드가 없는 상태를 명확히 드러낸다 — 조용히 통과시키지 않는다. */
  private notImplemented(): Error {
    return new ServiceUnavailableException(
      "본인인증이 현재 구성되지 않았습니다",
    );
  }
}
