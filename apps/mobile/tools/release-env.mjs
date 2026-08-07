import { isIP } from 'node:net';

const RELEASE_PROFILES = new Set(['preview', 'production']);
const SOCIAL_CLIENT_ID_KEYS = [
  'EXPO_PUBLIC_NAVER_CLIENT_ID',
  'EXPO_PUBLIC_KAKAO_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID',
];

function isPrivateIp(hostname) {
  if (isIP(hostname) === 4) {
    const [a, b] = hostname.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  if (isIP(hostname) === 6) {
    const normalized = hostname.toLowerCase();
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    );
  }

  return false;
}

function isPlaceholderOrLocalHost(hostname) {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'example.com' ||
    host.endsWith('.example.com') ||
    host.endsWith('.example') ||
    host.endsWith('.invalid') ||
    host.endsWith('.test') ||
    isPrivateIp(host)
  );
}

export function validateReleaseEnvironment(env = process.env) {
  const profile = env.EAS_BUILD_PROFILE?.trim();
  if (!RELEASE_PROFILES.has(profile)) {
    return { skipped: true, profile: profile || 'local' };
  }

  const rawApiUrl = env.EXPO_PUBLIC_API_URL?.trim();
  if (!rawApiUrl) {
    throw new Error(`${profile} EAS environment is missing EXPO_PUBLIC_API_URL`);
  }

  let apiUrl;
  try {
    apiUrl = new URL(rawApiUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be a valid absolute URL');
  }

  if (apiUrl.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_URL must use HTTPS for preview and production');
  }
  if (apiUrl.username || apiUrl.password) {
    throw new Error('EXPO_PUBLIC_API_URL must not contain credentials');
  }
  if (apiUrl.search || apiUrl.hash) {
    throw new Error('EXPO_PUBLIC_API_URL must not contain a query string or fragment');
  }
  if (isPlaceholderOrLocalHost(apiUrl.hostname)) {
    throw new Error('EXPO_PUBLIC_API_URL must use a public, non-placeholder hostname');
  }

  const configuredSocialProviders = SOCIAL_CLIENT_ID_KEYS.filter(
    (key) => Boolean(env[key]?.trim()),
  );
  if (configuredSocialProviders.length === 0) {
    throw new Error(
      `${profile} EAS environment must configure at least one social login client ID`,
    );
  }

  return {
    skipped: false,
    profile,
    apiOrigin: apiUrl.origin,
    configuredSocialProviders,
  };
}
