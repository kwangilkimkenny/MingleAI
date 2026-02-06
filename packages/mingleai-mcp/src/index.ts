#!/usr/bin/env node
/**
 * MingleAI MCP Server
 *
 * AI 소셜 매칭 플랫폼 "Another I"를 위한 MCP 서버입니다.
 * Backend REST API와 연동하여 프로필, 파티, 리포트, 데이트 플랜, 안전 기능을 제공합니다.
 *
 * 사용법:
 *   npx @mingle/mingleai-mcp
 *
 * 환경 변수:
 *   MINGLE_API_URL     - Backend API URL (기본: http://localhost:3000)
 *   MINGLE_AUTH_TOKEN  - 사전 설정 JWT 토큰 (선택)
 *   ANTHROPIC_API_KEY  - Claude API 키 (대화 시뮬레이션용, 선택)
 *   KAKAO_API_KEY      - Kakao Maps API 키 (장소 검색용, 선택)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";
import { config } from "./config.js";

const SERVER_NAME = "mingleai-mcp";
const SERVER_VERSION = "0.1.0";

async function main(): Promise<void> {
  // MCP 서버 생성
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // 모든 도구 등록
  registerAllTools(server);

  // Stdio 트랜스포트로 연결
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // 서버 정보 로깅 (stderr로 출력하여 MCP 프로토콜과 분리)
  console.error(`[${SERVER_NAME}] MCP Server started (v${SERVER_VERSION})`);
  console.error(`[${SERVER_NAME}] API URL: ${config.apiBaseUrl}`);
  console.error(`[${SERVER_NAME}] Auth: ${config.authToken ? "Pre-configured" : "Not set (use auth_login)"}`);
  console.error(`[${SERVER_NAME}] Tools registered: 30`);
  console.error(`[${SERVER_NAME}]   - Auth: 4 (register, login, logout, status)`);
  console.error(`[${SERVER_NAME}]   - Profile: 4 (create, get, update, list)`);
  console.error(`[${SERVER_NAME}]   - Party: 5 (create, get, add_participant, run, results)`);
  console.error(`[${SERVER_NAME}]   - Conversation: 4 (simulate, analyze_compatibility, icebreaker, suggest_message)`);
  console.error(`[${SERVER_NAME}]   - Report: 3 (generate, get, list)`);
  console.error(`[${SERVER_NAME}]   - DatePlan: 2 (create, get)`);
  console.error(`[${SERVER_NAME}]   - Venue: 5 (search, nearby, recommend_date_spots, travel_time, geocode)`);
  console.error(`[${SERVER_NAME}]   - Safety: 3 (check_content, check_profile, report_user)`);
}

main().catch((error) => {
  console.error(`[${SERVER_NAME}] Fatal error:`, error);
  process.exit(1);
});
