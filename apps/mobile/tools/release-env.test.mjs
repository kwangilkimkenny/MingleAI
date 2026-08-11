import assert from 'node:assert/strict';
import test from 'node:test';

import { validateReleaseEnvironment } from './release-env.mjs';

test('skips strict validation outside preview and production builds', () => {
  assert.deepEqual(validateReleaseEnvironment({ EAS_BUILD_PROFILE: 'development' }), {
    skipped: true,
    profile: 'development',
  });
});

test('accepts a public HTTPS API URL with a social provider', () => {
  const result = validateReleaseEnvironment({
    EAS_BUILD_PROFILE: 'production',
    EXPO_PUBLIC_API_URL: 'https://api.mingles.kr/v1',
    EXPO_PUBLIC_KAKAO_CLIENT_ID: 'public-client-id',
  });

  assert.equal(result.skipped, false);
  assert.equal(result.apiOrigin, 'https://api.mingles.kr');
  assert.deepEqual(result.configuredSocialProviders, ['EXPO_PUBLIC_KAKAO_CLIENT_ID']);
});

test('validates the signed-code-free iOS simulator profile like preview', () => {
  const result = validateReleaseEnvironment({
    EAS_BUILD_PROFILE: 'preview-simulator',
    EXPO_PUBLIC_API_URL: 'https://api.mingles.cloud',
    EXPO_PUBLIC_NAVER_CLIENT_ID: 'public-client-id',
  });

  assert.equal(result.skipped, false);
  assert.equal(result.profile, 'preview-simulator');
});

for (const invalidUrl of [
  'http://api.mingles.kr',
  'https://api.example.com',
  'https://localhost:3000',
  'https://10.0.2.2:3000',
  'https://192.168.0.2',
  'https://api.mingles.test',
  'not-a-url',
]) {
  test(`rejects unsafe release API URL: ${invalidUrl}`, () => {
    assert.throws(
      () =>
        validateReleaseEnvironment({
          EAS_BUILD_PROFILE: 'preview',
          EXPO_PUBLIC_API_URL: invalidUrl,
          EXPO_PUBLIC_NAVER_CLIENT_ID: 'public-client-id',
        }),
      /EXPO_PUBLIC_API_URL/,
    );
  });
}

test('requires at least one production social login provider', () => {
  assert.throws(
    () =>
      validateReleaseEnvironment({
        EAS_BUILD_PROFILE: 'production',
        EXPO_PUBLIC_API_URL: 'https://api.mingles.kr',
      }),
    /at least one social login client ID/,
  );
});
