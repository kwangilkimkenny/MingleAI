/**
 * 인증 도구
 * - auth_register: 회원가입
 * - auth_login: 로그인
 * - auth_logout: 로그아웃 (토큰 초기화)
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiClient } from "../client/api-client.js";
import { setAuthToken, clearAuthToken, isAuthenticated } from "../config.js";

const RegisterSchema = z.object({
  email: z.string().email("유효한 이메일을 입력하세요"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
});

const LoginSchema = z.object({
  email: z.string().email("유효한 이메일을 입력하세요"),
  password: z.string().min(1, "비밀번호를 입력하세요"),
});

export function registerAuthTools(server: McpServer): void {
  // auth_register
  server.tool(
    "auth_register",
    "회원가입을 진행합니다. 이메일과 비밀번호로 새 계정을 생성하고 자동 로그인됩니다.",
    RegisterSchema.shape,
    async ({ email, password }) => {
      try {
        const result = await apiClient.register(email, password);
        setAuthToken(result.accessToken);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: "회원가입 성공! 자동 로그인되었습니다.",
                email,
              }),
            },
          ],
        };
      } catch (error) {
        const err = error as { message?: string };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: err.message || "회원가입 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // auth_login
  server.tool(
    "auth_login",
    "로그인합니다. 성공 시 JWT 토큰이 저장되어 이후 API 호출에 자동 사용됩니다.",
    LoginSchema.shape,
    async ({ email, password }) => {
      try {
        const result = await apiClient.login(email, password);
        setAuthToken(result.accessToken);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: "로그인 성공!",
                email,
              }),
            },
          ],
        };
      } catch (error) {
        const err = error as { message?: string };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: err.message || "로그인 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // auth_logout
  server.tool(
    "auth_logout",
    "로그아웃합니다. 저장된 인증 토큰을 삭제합니다.",
    {},
    async () => {
      clearAuthToken();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: "로그아웃되었습니다.",
            }),
          },
        ],
      };
    }
  );

  // auth_status
  server.tool(
    "auth_status",
    "현재 인증 상태를 확인합니다.",
    {},
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              authenticated: isAuthenticated(),
              message: isAuthenticated()
                ? "로그인 상태입니다."
                : "로그인되지 않았습니다. auth_login을 사용하세요.",
            }),
          },
        ],
      };
    }
  );
}
