import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

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

/**
 * Run the provider's web OAuth (PKCE) and return the authorization code for the backend to
 * exchange. Returns null if cancelled or if no client id is configured for the provider.
 */
export async function startSocialOAuth(provider: SocialProvider): Promise<SocialAuthResult | null> {
  const clientId = CLIENT_ID[provider];
  if (!clientId) return null;

  const redirectUri = AuthSession.makeRedirectUri({ scheme: "mingleai", path: "auth" });
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: provider !== "naver",
    scopes: SCOPES[provider],
  });

  const result = await request.promptAsync({ authorizationEndpoint: AUTHORIZE[provider] });
  if (result.type !== "success" || !result.params.code) return null;

  return {
    code: result.params.code,
    redirectUri,
    codeVerifier: request.codeVerifier ?? (result.params.state as string | undefined),
  };
}
