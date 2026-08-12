import { BadGatewayException, UnauthorizedException } from "@nestjs/common";

/**
 * Social OAuth provider adapters (Kakao / Naver / Google) using plain REST `fetch` — no vendor
 * SDKs. Each exchanges an authorization code for the provider's user profile. `isConfigured()`
 * reflects whether client credentials are present (empty env = provider disabled → 503).
 *
 * The exact HTTP contracts are best-effort against each provider's documented OAuth endpoints;
 * verify against a real developer app during credential setup (see runbook).
 */

export interface SocialProfile {
  providerId: string;
  email?: string;
  name?: string;
}

export interface SocialProvider {
  readonly name: string;
  isConfigured(): boolean;
  /** For Naver, `codeVerifier` carries the OAuth `state`; for Kakao/Google it is the PKCE verifier. */
  exchange(code: string, redirectUri: string, codeVerifier?: string): Promise<SocialProfile>;
}

type ProviderJson = Record<string, unknown>;
const PROVIDER_TIMEOUT_MS = 10_000;

async function providerFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch {
    throw new BadGatewayException("소셜 로그인 제공자에 연결하지 못했습니다");
  }
}

async function providerJson(res: Response): Promise<ProviderJson> {
  try {
    const body: unknown = await res.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid body");
    return body as ProviderJson;
  } catch {
    throw new BadGatewayException("소셜 로그인 제공자 응답이 올바르지 않습니다");
  }
}

function errorCode(body: ProviderJson): string {
  const value = body.error ?? body.errorCode ?? body.code;
  return typeof value === "string" ? value.toLowerCase() : "";
}

function requiredString(body: ProviderJson, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new BadGatewayException("소셜 로그인 제공자 응답이 올바르지 않습니다");
  }
  return value;
}

function requiredProviderId(value: unknown): string {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") {
    throw new BadGatewayException("소셜 로그인 제공자 응답이 올바르지 않습니다");
  }
  return String(value);
}

async function postForm(url: string, body: Record<string, string>): Promise<ProviderJson> {
  const res = await providerFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = await providerJson(res);
  if (!res.ok) {
    // OAuth token endpoints also use 400/401 for server-side client/configuration errors.
    // Only an invalid authorization grant is attributable to the user's expired/used code.
    if (errorCode(json) === "invalid_grant") {
      throw new UnauthorizedException("소셜 로그인 인증이 만료되었거나 유효하지 않습니다");
    }
    throw new BadGatewayException("소셜 로그인 제공자 응답에 실패했습니다");
  }
  return json;
}

async function getJson(url: string, accessToken: string): Promise<ProviderJson> {
  const res = await providerFetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await providerJson(res);
  if (!res.ok) {
    if (res.status === 401 || errorCode(json) === "invalid_token") {
      throw new UnauthorizedException("소셜 로그인 인증이 만료되었거나 유효하지 않습니다");
    }
    throw new BadGatewayException("소셜 로그인 제공자 응답에 실패했습니다");
  }
  return json;
}

export class KakaoProvider implements SocialProvider {
  readonly name = "kakao";
  constructor(private clientId?: string, private clientSecret?: string) {}
  isConfigured(): boolean {
    return !!this.clientId;
  }
  async exchange(code: string, redirectUri: string, codeVerifier?: string): Promise<SocialProfile> {
    const token = await postForm("https://kauth.kakao.com/oauth/token", {
      grant_type: "authorization_code",
      client_id: this.clientId!,
      redirect_uri: redirectUri,
      code,
      ...(this.clientSecret ? { client_secret: this.clientSecret } : {}),
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });
    const me = await getJson(
      "https://kapi.kakao.com/v2/user/me",
      requiredString(token, "access_token"),
    );
    const account = me.kakao_account as ProviderJson | undefined;
    const profile = account?.profile as ProviderJson | undefined;
    const properties = me.properties as ProviderJson | undefined;
    return {
      providerId: requiredProviderId(me.id),
      email: typeof account?.email === "string" ? account.email : undefined,
      name:
        typeof profile?.nickname === "string"
          ? profile.nickname
          : typeof properties?.nickname === "string"
            ? properties.nickname
            : undefined,
    };
  }
}

export class NaverProvider implements SocialProvider {
  readonly name = "naver";
  constructor(private clientId?: string, private clientSecret?: string) {}
  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }
  async exchange(code: string, _redirectUri: string, state?: string): Promise<SocialProfile> {
    const token = await postForm("https://nid.naver.com/oauth2.0/token", {
      grant_type: "authorization_code",
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
      code,
      state: state ?? "",
    });
    const me = await getJson(
      "https://openapi.naver.com/v1/nid/me",
      requiredString(token, "access_token"),
    );
    const profile = me.response as ProviderJson | undefined;
    return {
      providerId: requiredProviderId(profile?.id),
      email: typeof profile?.email === "string" ? profile.email : undefined,
      name: typeof profile?.name === "string" ? profile.name : undefined,
    };
  }
}

export class GoogleProvider implements SocialProvider {
  readonly name = "google";
  constructor(private clientId?: string, private clientSecret?: string) {}
  isConfigured(): boolean {
    return !!this.clientId;
  }
  async exchange(code: string, redirectUri: string, codeVerifier?: string): Promise<SocialProfile> {
    const token = await postForm("https://oauth2.googleapis.com/token", {
      grant_type: "authorization_code",
      client_id: this.clientId!,
      ...(this.clientSecret ? { client_secret: this.clientSecret } : {}),
      redirect_uri: redirectUri,
      code,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });
    const me = await getJson(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      requiredString(token, "access_token"),
    );
    return {
      providerId: requiredProviderId(me.sub),
      email: typeof me.email === "string" ? me.email : undefined,
      name: typeof me.name === "string" ? me.name : undefined,
    };
  }
}
