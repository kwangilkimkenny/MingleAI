/**
 * 본인인증 공급자 경계 타입.
 *
 * 공급자는 **NICE 직계약** 하나다(2026-08-10 결정, 2026-08-12 PortOne 경로 삭제 — 키도 계약도
 * 없어 실효가 0이었고, 보안 핵심 경로에 안 쓰는 분기를 두는 값이 더 컸다). 계약이 끝나면
 * NICE provider를 구현하고 AuthModule·IdentityService·콜백 라우트에 연결한다.
 * `IdentityService`는 "누가 인증했든 검증된 신원을 받아 저장하고 CI로 1인 1계정을 강제한다"는
 * 자기 일만 한다.
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

/** 현재 구현된 시작 응답. NICE 응답 타입은 실제 계약 규격과 함께 추가한다. */
export type IdentityStart = { mode: "dev" };
