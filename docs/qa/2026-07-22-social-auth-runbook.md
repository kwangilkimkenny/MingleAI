# 소셜 인증 + 본인인증 + 동의·권한 게이트 — 셋업 런북 (2026-07-22)

Spec: `docs/superpowers/specs/2026-07-22-social-auth-identity-consent-design.md`. 코드/로직/테스트는 브랜치에 있음(backend 396, client-core 80, shared 34, mobile 127 그린). 이 문서는 **사용자 머신·외부 계정 단계**만 다룬다.

## 1. DB 마이그레이션 적용 (직접, `!` prefix)

```
cd apps/backend
pnpm prisma:migrate          # 20260722120000_social_auth_identity (+ 20260722090000_speed_date)
```

User에 소셜/본인인증 컬럼 + `consent_grants` 테이블 + unique 인덱스(identity_ci, (auth_provider, provider_id))를 만든다. email/password_hash는 nullable로 바뀐다.

## 2. 혼자 테스트 (OAuth·본인인증 계정 없이)

backend `.env`:

```
DEV_AUTH_ENABLED=true
IDENTITY_DEV_BYPASS=true
```

1. 앱 실행 → 로그인 화면에서 **dev 로그인**(이메일 아무거나) → 토큰 발급.
2. 게이트 사다리 진행: 동의 3종 체크 → 카메라·마이크 권한 허용(실기기/dev build 필요; 웹은 브라우저 권한) → **본인인증**(개발용 폼: 이름·생년월일·성별·전화) → 프로필 온보딩 → 홈.
3. 본인인증의 성별·생년월일이 프로필 age/gender에 반영되는지 확인(자기신고 덮어씀).
4. 같은 전화번호로 다른 계정이 본인인증 시 409(1인 1계정) 확인.

⚠️ `DEV_AUTH_ENABLED`/`IDENTITY_DEV_BYPASS`는 **production에서 `true`면 부팅이 막힌다**(env.validation).

## 3. 실제 소셜 OAuth 연결

각 provider 개발자 콘솔에서 앱 등록 → client id/secret + redirect URI 등록.

- 리다이렉트 URI(웹 OAuth): `mingles://auth` (앱 스킴; `app.json` `scheme: "mingles"`). provider가 커스텀 스킴을 거부하면 Expo proxy(`https://auth.expo.io/...`)나 유니버설 링크 사용 — provider별 정책 확인.
- backend `.env`: `KAKAO_CLIENT_ID/SECRET`, `NAVER_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`.
- mobile `apps/mobile/.env`: `EXPO_PUBLIC_KAKAO_CLIENT_ID`, `EXPO_PUBLIC_NAVER_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`(public id만; secret은 backend).
- 버튼은 `EXPO_PUBLIC_*_CLIENT_ID`가 있는 provider만 노출(`socialClientAvailable`). backend 미설정 provider는 `/auth/social`에서 501.
- provider별 HTTP 계약은 `apps/backend/src/auth/social/social.provider.ts`에 best-effort로 구현 — 실제 앱으로 토큰·userinfo 응답 필드 검증 필요(카카오 `kakao_account.email`, 네이버 `response.id`, 구글 `sub`).

## 4. 실제 본인인증(실명) 연결

`apps/backend/src/auth/identity/identity.service.ts`가 seam. dev bypass 대신 실제 인증기관(NICE평가정보·KCB·PASS·KG이니시스 등) 연동:

1. 인증기관 계약 + SDK/키 수령.
2. `start()`가 인증기관 redirect URL 반환하도록 구현(현재 dev면 `{mode:"dev"}`, 아니면 503).
3. 인증기관 콜백(서버-투-서버 암호화 결과)을 복호화해 `{name, birth, gender, phone, ci, di}` 추출 → 기존 `complete()`의 저장 로직 재사용(`identityCi` unique로 중복가입 방지).
4. 모바일 `verify-identity.tsx`가 `mode:"redirect"`면 `WebBrowser`로 redirectUrl 열도록 확장(현재는 dev 폼만).

## 5. EAS dev build

`expo-auth-session`·`expo-camera`·`expo-crypto`는 Expo 1st-party라 웹 export는 그대로 동작하지만, OAuth 리다이렉트·실 카메라/마이크 권한은 **EAS dev build + 실기기**에서 검증:

```
cd apps/mobile
npx eas-cli build --profile development --platform ios   # 또는 android
```

## 6. 남은 항목 / 백로그

- **웹 admin 로그인**: email/password 제거로 prod admin 접근 없음 → admin SSO 또는 소셜+role 부여(dev는 `/auth/dev-login`에 `role:"admin"`). 웹 소비자 register 화면은 정리 대상.
- mega-qa(`tools/mega-qa.mjs`)는 구 `/auth/register`·`/auth/login`을 쓰므로 **소셜/dev-login 기준으로 재작성** 필요.
- 계정 연동(email↔social 병합), 카메라/마이크 외 권한, 스토어 심사(무관 권한 강제 리스크).
