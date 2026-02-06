/**
 * MingleAI MCP Server 설정
 */

export interface Config {
  /** Backend API Base URL */
  apiBaseUrl: string;
  /** JWT 토큰 (로그인 후 설정) */
  authToken: string | null;
  /** Claude API Key (대화 시뮬레이션용) */
  claudeApiKey: string | null;
  /** Kakao Maps API Key (장소 검색용) */
  kakaoApiKey: string | null;
}

// 런타임 설정 (MCP 세션 동안 유지)
export const config: Config = {
  apiBaseUrl: process.env.MINGLE_API_URL || "http://localhost:3000",
  authToken: process.env.MINGLE_AUTH_TOKEN || null,
  claudeApiKey: process.env.ANTHROPIC_API_KEY || null,
  kakaoApiKey: process.env.KAKAO_API_KEY || null,
};

/**
 * 인증 토큰 설정
 */
export function setAuthToken(token: string): void {
  config.authToken = token;
}

/**
 * 인증 토큰 초기화
 */
export function clearAuthToken(): void {
  config.authToken = null;
}

/**
 * 인증 여부 확인
 */
export function isAuthenticated(): boolean {
  return config.authToken !== null;
}
