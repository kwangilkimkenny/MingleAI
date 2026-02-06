/**
 * MCP 도구 등록 모듈
 * 모든 도구를 MCP 서버에 등록합니다.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAuthTools } from "./auth.tools.js";
import { registerProfileTools } from "./profile.tools.js";
import { registerPartyTools } from "./party.tools.js";
import { registerConversationTools } from "./conversation.tools.js";
import { registerReportTools } from "./report.tools.js";
import { registerDatePlanTools } from "./date-plan.tools.js";
import { registerVenueTools } from "./venue.tools.js";
import { registerSafetyTools } from "./safety.tools.js";

/**
 * 모든 MCP 도구를 서버에 등록
 */
export function registerAllTools(server: McpServer): void {
  // 인증 도구 (4개)
  // - auth_register: 회원가입
  // - auth_login: 로그인
  // - auth_logout: 로그아웃
  // - auth_status: 인증 상태 확인
  registerAuthTools(server);

  // 프로필 도구 (4개)
  // - create_profile: 프로필 생성
  // - get_profile: 프로필 조회
  // - update_profile: 프로필 수정
  // - list_profiles: 프로필 목록
  registerProfileTools(server);

  // 파티 도구 (5개)
  // - create_party: 파티 생성
  // - get_party: 파티 조회
  // - add_participant: 참가자 추가
  // - run_party: 파티 실행
  // - get_party_results: 파티 결과 조회
  registerPartyTools(server);

  // AI 대화 도구 (4개) - ANTHROPIC_API_KEY 필요
  // - simulate_conversation: 에이전트 대화 시뮬레이션
  // - analyze_compatibility: 호환성 심층 분석
  // - generate_icebreaker: 아이스브레이커 생성
  // - suggest_message: 메시지 추천
  registerConversationTools(server);

  // 리포트 도구 (3개)
  // - generate_report: 리포트 생성
  // - get_report: 리포트 조회
  // - list_reports: 리포트 목록
  registerReportTools(server);

  // 데이트 플랜 도구 (2개)
  // - create_date_plan: 데이트 플랜 생성
  // - get_date_plan: 데이트 플랜 조회
  registerDatePlanTools(server);

  // 장소 검색 도구 (5개) - KAKAO_API_KEY 필요
  // - search_venues: 키워드 검색
  // - search_nearby: 주변 검색
  // - recommend_date_spots: 데이트 장소 추천
  // - get_travel_time: 이동 시간 계산
  // - geocode: 주소 → 좌표 변환
  registerVenueTools(server);

  // 안전 도구 (3개)
  // - check_content: 콘텐츠 검사
  // - check_profile: 프로필 검사
  // - report_user: 유저 신고
  registerSafetyTools(server);

  // 총 30개 도구 등록
}

export {
  registerAuthTools,
  registerProfileTools,
  registerPartyTools,
  registerConversationTools,
  registerReportTools,
  registerDatePlanTools,
  registerVenueTools,
  registerSafetyTools,
};
