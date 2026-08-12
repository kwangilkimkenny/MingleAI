/**
 * 본인인증 화면이 어떤 모드로 뜰지. 서버가 dev bypass를 켠 개발 빌드에서만 수동 입력을 허용하고,
 * 그 외에는 "사용 불가"로 막는다 — 운영 번들이 개발용 완료 API를 호출하는 일이 없어야 한다.
 * 실 공급자(NICE)는 계약 후 여기에 갈래가 하나 늘어난다(2026-08-12 PortOne 경로 삭제).
 */
export function resolveIdentityVerificationMode(
  serverMode: "dev",
  isDevelopmentBuild: boolean,
): "dev" | "unavailable" {
  return serverMode === "dev" && isDevelopmentBuild ? "dev" : "unavailable";
}
