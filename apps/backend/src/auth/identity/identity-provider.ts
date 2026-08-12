/**
 * 본인인증 공급자 seam.
 *
 * 공급자는 **NICE 직계약** 하나다(2026-08-10 결정, 2026-08-12 PortOne 경로 삭제 — 키도 계약도
 * 없어 실효가 0이었고, 보안 핵심 경로에 안 쓰는 분기를 두는 값이 더 컸다). 계약이 끝나면
 * `NiceIdentityProvider`만 채우면 된다 — `IdentityService`는 "누가 인증했든 검증된 신원을 받아
 * 저장하고 CI로 1인 1계정을 강제한다"는 자기 일만 한다.
 *
 * 규칙: 이름·생년월일·성별·CI는 **언제나 공급자 서버에서 다시 읽는다**. 클라이언트가 보낸 값을
 * 신뢰하는 순간 나이·성별 게이트가 통째로 무의미해진다.
 */

/** 공급자가 확인해 준 신원. 이 형태로 들어오면 그 뒤 처리는 공급자와 무관하다. */
export interface VerifiedIdentity {
  name: string;
  /** YYYY-MM-DD */
  birth: string;
  gender: "male" | "female";
  phone: string;
  /** 연계정보 — 1인 1계정 판정 키. */
  ci: string;
  di?: string;
}

/** 앱이 인증창을 띄우는 데 필요한 값. 공급자마다 모양이 달라 판별 가능한 union으로 둔다. */
export type IdentityStart =
  | { mode: "dev" }
  | { mode: "nice"; requestId: string; encData: string; integrityValue: string; returnUrl: string };

export interface IdentityProvider {
  /** env가 갖춰졌는지 — 아니면 라우트가 503으로 답한다. */
  readonly configured: boolean;
  /** 인증 시작에 필요한 값 생성(요청 id는 인증 결과를 이 사용자에게 묶는 데 쓴다). */
  start(userId: string): Promise<IdentityStart>;
  /** 공급자 서버에서 결과를 다시 읽어 검증된 신원을 돌려준다. */
  verify(userId: string, providerToken: string): Promise<VerifiedIdentity>;
}
