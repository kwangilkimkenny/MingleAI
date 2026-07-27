# 소셜 전용 인증 + 본인인증 + 동의·권한 하드게이트 — 설계

작성일: 2026-07-22
브랜치: `megahuni`
상태: 설계 확정(사용자 승인) → 구현 착수

## 요약

회원가입/로그인을 **소셜 전용**(카카오·네이버·구글, 웹 OAuth)으로 전환하고 이메일/패스워드를 제거한다. **본인인증(실명)**을 필수화하고, 가입 직후 **개인정보·약관·성인 동의 + 카메라·마이크 OS 권한**을 모두 받는다. 하나라도 미충족이면 서비스 이용 불가(하드 게이트). 개발/CI/관리자 테스트용 **dev 로그인**을 추가한다.

외부 계정 의존(OAuth 앱, 본인확인기관 계약)은 **어댑터 seam + env 미설정 시 비활성 + dev stub**로 처리(LiveKit 방식). 백엔드 로직은 jest로 완전 검증, 실연동은 사용자가 credential 연결.

## 확정 결정

| # | 결정 |
|---|---|
| 1 | 인증 = **소셜 전용**(kakao/naver/google). email/password register·login **전면 제거** |
| 2 | 소셜 = **웹 OAuth**(`expo-auth-session`+`expo-web-browser`+`expo-crypto` PKCE), provider별 네이티브 SDK 미사용 |
| 3 | **dev-login** 추가(`POST /auth/dev-login`, env `DEV_AUTH_ENABLED`, prod 강제 off) — dev·CI·seeder·admin |
| 4 | **본인인증(실명)** 필수, 어댑터 seam + dev bypass stub. 소셜 신규가입도 필수 |
| 5 | 본인인증의 **gender·birth(→age)를 프로필 권위값**으로 반영(자기신고 대신 검증값) |
| 6 | 동의 granular: `terms`·`privacy`·`age19` → `ConsentGrant` |
| 7 | **카메라+마이크 하드 게이트**(`expo-camera`) — 거부 시 서비스 진입 전면 차단 |
| 8 | `deleteAccount` 비밀번호 재확인 제거(소셜=비번 없음) → `confirmation:"DELETE"`+유효세션 |
| 9 | prod 관리자 로그인 = **백로그**(admin SSO 또는 소셜+role). dev는 dev-login으로 admin 발급 |

⚠️ 스토어 리스크 기록: 무관 기능에 카메라/마이크 권한을 강제 차단하면 Apple/Google 리젝 가능. 사용자 판단으로 진행.

## 데이터 모델 (신규 마이그레이션)

**User 변경**:
- `passwordHash` → **nullable**(소셜/dev 계정은 없음; 컬럼 드롭 안 함)
- `authProvider String @default("local")` — `kakao|naver|google|dev`(local은 레거시)
- `providerId String?` + `@@unique([authProvider, providerId])`
- `phoneNumber String?` · `phoneVerifiedAt DateTime?`
- `identityCi String? @unique` — 연계정보(**1인 1계정** 중복가입 방지) · `identityDi String?`
- `verifiedName String?` · `verifiedBirth DateTime?` · `verifiedGender String?`

**신규 `ConsentGrant`**: `id, userId, scope(terms|privacy|age19), version, grantedAt` + `@@unique([userId, scope])`(scope당 최신 1행, 재동의는 version/grantedAt 갱신). 기존 `termsAcceptedAt/Version`·`privacyVersion`은 유지·병행(레거시 표시용).

카메라/마이크는 OS 권한이라 DB 미저장(클라가 OS 상태로 게이트). 서버엔 개인정보·약관·성인 동의만 기록.

## 소셜 로그인 (웹 OAuth)

- **모바일**: `expo-auth-session`로 provider authorize(PKCE, `expo-crypto`) → code 수신 → 딥링크 `mingles://` 복귀 → 백엔드로 `{code, redirectUri, codeVerifier}` 전송.
- **백엔드** `POST /auth/social/:provider`: code→provider 토큰 교환→유저정보 조회→`(authProvider, providerId)` find-or-create→우리 JWT+refresh. 미설정 provider는 501/비활성.
- 어댑터 `SocialProvider { exchange(code, redirectUri, codeVerifier): Promise<{ providerId, email?, name? }> }` — Kakao/Naver/Google **REST fetch**(SDK 불필요). Google은 id_token을 tokeninfo로 검증(무의존).
- env: `KAKAO_CLIENT_ID/SECRET`, `NAVER_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`(빈 값=버튼 숨김·엔드포인트 501).

## 본인인증 (실명)

- 어댑터 seam `IdentityVerificationProvider { start(): Promise<{redirectUrl, txId}>; complete(payload): Promise<VerifiedIdentity> }` — `VerifiedIdentity = {name, birth, gender, phone, ci, di}`. 실제는 NICE/PASS/KG이니시스 등 계약+SDK(런북 문서화, 사용자 credential 단계).
- **dev stub**(`IDENTITY_DEV_BYPASS=true`, prod 금지): 테스트 신원 입력 → 즉시 verified. 혼자 검증용.
- 백엔드 `POST /auth/identity/start`·`POST /auth/identity/complete`: complete가 `phoneVerifiedAt`·`identityCi`(unique 위반=이미 가입된 사람 409)·verified name/birth/gender 저장 + **프로필 gender/age 권위 반영**(프로필 있으면 갱신, 없으면 온보딩 프리필·잠금).
- CI 중복 = 중복가입 차단(1인 1계정).

## 동의 + 권한 게이트 (핵심)

**모바일 게이트 사다리**(`app/(app)/_layout.tsx` 리다이렉트 확장 — 순서대로 미충족 시 해당 화면, 하나라도 안 되면 진입 불가):

1. `token` 없음 → `app/login.tsx`(소셜 버튼 3종 + `__DEV__` dev-login)
2. **동의**(terms·privacy·age19) 미완 → `app/consent.tsx`(granular 필수 체크)
3. **카메라+마이크** OS 미허용 → `app/permissions.tsx`(요청; 거부 시 "설정에서 허용" + 진입 차단 유지)
4. **본인인증** 미완 → `app/verify-identity.tsx`
5. **프로필** 없음 → 기존 `onboarding`
6. → 탭

게이트 판정에 필요한 서버 상태는 `GET /auth/account-status` → `{ phoneVerifiedAt, consents:{terms,privacy,age19}, hasProfile, provider }`. 순수 판정함수 `nextGate(status, permissionState)` → `@mingle/shared`(단위테스트).

**서버 하드 게이트** `VerifiedGuard`(신규): 민감 기능(매칭 enqueue·party·speed-date enqueue·proposal·DM send)에 `phoneVerifiedAt` + privacy 동의 필수. auth/consent/identity/account-status/profile 라우트는 제외. `AccountAccessService.requireActive`는 그대로(가입 직후 게이트 라우트는 살아야 함 — 전면 차단 아님).

## 제거 (email/password)

- backend: `auth.service` register/login/validateUser + `local.strategy` + `login.dto`/`register.dto` + `/auth/register`·`/auth/login` 라우트. `auth.service.spec` 갱신.
- client-core: `register`/`login`(→ `socialLogin`/`devLogin`로 대체). `AuthResponse` 유지.
- mobile: `app/register.tsx` 삭제, `app/login.tsx`를 소셜 화면으로 교체. `index.tsx` → 토큰 없으면 `/login`.
- web: 소비자 RegisterForm 제거. admin 로그인은 dev-login 경유(dev) / 백로그(prod).
- `deleteAccount`: 비번 체크 제거.

## client-core 신규

`socialLogin(provider, code, redirectUri, codeVerifier)` · `devLogin(email, role?)` · `getAccountStatus()` · `submitConsents(scopes)` · `startIdentityVerification()` · `completeIdentityVerification(payload)`. `AuthState`는 그대로(token/refreshToken/profileId/role); 게이트 상태는 진입 시 `getAccountStatus` 조회.

## deps / env

- 모바일 신규: `expo-auth-session`·`expo-crypto`·`expo-camera`(전부 Expo 1st-party, **웹 export 호환**). 설치 필요.
- 백엔드 신규 없음(provider=fetch). env.validation에 신규 키(빈 값 허용, prod 경고), `DEV_AUTH_ENABLED`/`IDENTITY_DEV_BYPASS`는 prod에서 강제 false 검증.

## 테스트

- **shared(vitest)**: `nextGate` 판정, consent scope/provider enum.
- **backend(jest)**: 소셜 find-or-create·CI 중복 409·identity complete가 프로필 gender/age 반영·VerifiedGuard 차단/통과·consent upsert·dev-login(prod off)·deleteAccount(비번 없이). provider fetch 목킹.
- **client-core(vitest)**: 신규 api.
- **mobile(vitest 순수 lib)**: 게이트 판정·권한 리듀서.
- 실 OAuth·본인인증·권한 프롬프트·EAS = 런북.

## 빌드 순서

1. shared: enum·`nextGate` (+테스트)
2. DB: User 확장 + ConsentGrant + 마이그레이션 + generate
3. backend: consent·social(어댑터)·identity(어댑터+stub)·dev-login 서비스/컨트롤러 + VerifiedGuard + email/pw 제거 (TDD)
4. client-core: api + 타입
5. mobile: login(소셜)·consent·permissions·verify-identity 화면 + `_layout` 사다리 + deps + register 삭제
6. env·런북·CLAUDE.md
7. 전체 그린(test/lint/tsc/build)

## 범위 밖 / 백로그

- prod 관리자 로그인(admin SSO/소셜+role). 실제 본인확인기관·OAuth provider 연동(사용자 credential). 계정 연동(email↔social 병합). 카메라/마이크 외 권한(알림은 기존 push). 스토어 심사 대응.
