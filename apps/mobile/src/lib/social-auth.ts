import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = "kakao" | "naver" | "google";

const AUTHORIZE: Record<SocialProvider, string> = {
  kakao: "https://kauth.kakao.com/oauth/authorize",
  naver: "https://nid.naver.com/oauth2.0/authorize",
  google: "https://accounts.google.com/o/oauth2/v2/auth",
};

/** Public OAuth client ids (safe on-device). The client SECRET stays server-side. */
const CLIENT_ID: Record<SocialProvider, string | undefined> = {
  kakao: process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID,
  naver: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID,
  google: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
};

const SCOPES: Record<SocialProvider, string[]> = {
  kakao: [],
  naver: [],
  google: ["openid", "email", "profile"],
};

/** Whether this device has a client id configured for the provider (button visibility). */
export function socialClientAvailable(provider: SocialProvider): boolean {
  return !!CLIENT_ID[provider];
}

export interface SocialAuthResult {
  code: string;
  redirectUri: string;
  /** PKCE verifier (kakao/google) or OAuth state (naver) — the backend uses whichever the provider needs. */
  codeVerifier?: string;
}

/** The app deep link the backend callback bounces to (must stay in sync with auth.controller). */
const RETURN_URL = "mingleai://auth";

/**
 * Run the provider's web OAuth (PKCE) and return the authorization code for the backend to
 * exchange. Returns null if cancelled or if no client id is configured for the provider.
 *
 * Redirect flow: Kakao/Naver/Google consoles only accept http(s) redirect URIs, so the provider
 * redirects to the BACKEND (`/auth/callback/:provider`), which 302-bounces the code into the
 * app's `mingleai://auth` deep link. We open the auth URL manually so the browser session closes
 * on that deep link (AuthRequest.promptAsync would wait for the http redirect instead).
 */
export async function startSocialOAuth(provider: SocialProvider): Promise<SocialAuthResult | null> {
  const clientId = CLIENT_ID[provider];
  if (!clientId) return null;

  const apiBase = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const redirectUri = `${apiBase}/auth/callback/${provider}`;
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: provider !== "naver",
    scopes: SCOPES[provider],
  });

  const authUrl = await request.makeAuthUrlAsync({ authorizationEndpoint: AUTHORIZE[provider] });
  const result = await WebBrowser.openAuthSessionAsync(authUrl, RETURN_URL);
  if (result.type !== "success" || !result.url) return null;

  const params = Linking.parse(result.url).queryParams ?? {};
  const code = typeof params.code === "string" ? params.code : undefined;
  if (!code) return null;
  const state = typeof params.state === "string" ? params.state : undefined;

  return {
    code,
    redirectUri,
    codeVerifier: request.codeVerifier ?? state,
  };
}
