/**
 * Social OAuth provider adapters (Kakao / Naver / Google) using plain REST `fetch` — no vendor
 * SDKs. Each exchanges an authorization code for the provider's user profile. `isConfigured()`
 * reflects whether client credentials are present (empty env = provider disabled → 501).
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

async function postForm(url: string, body: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`token exchange failed (${res.status})`);
  return res.json();
}

async function getJson(url: string, accessToken: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`userinfo failed (${res.status})`);
  return res.json();
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
    const me = await getJson("https://kapi.kakao.com/v2/user/me", token.access_token);
    return {
      providerId: String(me.id),
      email: me.kakao_account?.email,
      name: me.kakao_account?.profile?.nickname ?? me.properties?.nickname,
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
    const me = await getJson("https://openapi.naver.com/v1/nid/me", token.access_token);
    return { providerId: String(me.response?.id), email: me.response?.email, name: me.response?.name };
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
    const me = await getJson("https://www.googleapis.com/oauth2/v3/userinfo", token.access_token);
    return { providerId: String(me.sub), email: me.email, name: me.name };
  }
}
