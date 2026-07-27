# 소셜 로그인(카카오·네이버·구글) 연동 가이드

코드 배선은 **완료** 상태다. 남은 것은 각 개발자 콘솔에서 앱 등록 + 키 발급(계정 소유자만 가능).
키를 env에 넣는 순간 로그인 버튼이 활성화된다(미설정 provider는 자동 숨김/비활성).

## 현재 배선 (2026-07-27 콜백 방식 — 카카오가 커스텀 스킴 400 거부해 전환)

- 모바일: `src/lib/social-auth.ts` — authorize URL을 브라우저로 열고 **redirect_uri =
  `${API_URL}/auth/callback/<provider>`**(콘솔은 http/https만 허용). 백엔드 콜백이
  `mingleai://auth?code=…`로 302 반사 → 앱이 딥링크로 code 수신 → `POST /auth/social`.
  PKCE(카카오·구글)·state(네이버) 자동 처리.
- 백엔드: `GET /auth/callback/:provider`(auth.controller — 화이트리스트 파라미터만 고정 스킴으로
  반사) + `auth/social/social.provider.ts` code→token 교환 → `(authProvider, providerId)` upsert.
  **email·닉네임 등 프로필 스코프는 전부 optional** — 동의항목 0개로 동작(최소 수집).

## 콘솔에 입력할 공통 값

| 항목 | 값 |
|---|---|
| Android 패키지명 | `com.mingleai.app` |
| iOS 번들 ID | `com.mingleai.app` |
| Redirect/Callback URI (dev) | `http://localhost:3000/auth/callback/<provider>` |
| Redirect/Callback URI (prod) | `https://api.<도메인>/auth/callback/<provider>` (도메인 확정 시 추가) |

## 1. 카카오 — ✅ 완료 (2026-07-27, 앱 ID 1525003 "mingles")

- 앱 생성·카카오 로그인 활성화·Redirect URI(`http://localhost:3000/auth/callback/kakao`) 등록 완료.
- REST API 키 → 모바일 `EXPO_PUBLIC_KAKAO_CLIENT_ID` + 백엔드 `KAKAO_CLIENT_ID`,
  Client Secret(활성화 ON) → `KAKAO_CLIENT_SECRET` — 로컬 `.env` 배선 완료.
- 동의항목 = **없음**(의도 — 회원식별값만 수집, 최소 수집 방침).
- 에뮬레이터에서 "카카오로 시작하기" → 카카오 로그인 페이지 정상 로드 검증(KOE 에러 없음).
- 남은 것: prod 도메인 확정 시 Redirect URI 추가, (선택) 앱 아이콘 등록.

## 2. 네이버 (developers.naver.com)

1. Application → 애플리케이션 등록 → 사용 API: **네이버 로그인**.
2. 제공 정보: 이메일·별명(필요 범위만).
3. 환경: 서비스 URL + **Callback URL에 `mingleai://auth`** 등록.
4. 키 반영:
   - 모바일 `.env`: `EXPO_PUBLIC_NAVER_CLIENT_ID=<Client ID>`
   - 백엔드 `.env`: `NAVER_CLIENT_ID=<Client ID>` / `NAVER_CLIENT_SECRET=<Client Secret>`
   - (검색 API와 같은 앱이면 `NAVER_SEARCH_CLIENT_*`도 동일 값)

## 3. 구글 — ✅ 완료 (2026-07-27, GCP 프로젝트 mingles-503701)

- 프로젝트 "mingles" 생성, OAuth 동의화면 구성(외부·테스트 모드, 지원/연락 이메일 설정).
- **웹 애플리케이션 클라이언트** "mingles" 생성(콜백 방식이라 웹 타입으로 충분) —
  redirect `http://localhost:3000/auth/callback/google` 등록.
- 클라이언트 ID/Secret → 로컬 `.env` 배선 완료(backend GOOGLE_*, mobile EXPO_PUBLIC_*).
- 테스트 사용자 등록: skdkan31@gmail.com (외부·테스트 모드에선 등록된 계정만 로그인 가능 —
  베타 테스터 추가 시 대상(audience) 페이지에서 추가, 정식 오픈 시 앱 게시).
- 에뮬레이터 검증: 구글 버튼 → "Sign in to continue to mingles" 정상 로드(mismatch 없음).
- 남은 것: prod 도메인 redirect 추가, 스토어 출시 전 동의화면 게시(퍼블리싱).

## ⚠️ 알려진 리스크 (등록 시 확인)

- **커스텀 스킴 등록 거부 가능성**: 카카오·네이버 콘솔이 `mingleai://auth` 형식을 거부하면
  백엔드 콜백 방식(https redirect → 딥링크 반사)으로 전환해야 한다 — 이 경우 백엔드에
  `GET /auth/callback/:provider` 추가 + 콘솔에는 `https://api.<도메인>/auth/callback/<provider>`
  등록(코드 작업 필요, 요청 시 진행).
- **구글 redirect 스킴**: 구글 iOS 클라이언트는 reversed-client-id 스킴
  (`com.googleusercontent.apps.<id>:/oauth`)을 요구할 수 있다 — 등록 화면에서 확인되면
  `social-auth.ts`의 구글 redirect만 분기(소규모 코드 작업, 요청 시 진행).

## 발급 후 검증 절차

1. 두 `.env` 반영 → 백엔드 재시작 + Metro 재시작(`EXPO_PUBLIC_*`은 번들에 인라인).
2. 에뮬/실기기 로그인 화면에서 provider 버튼 활성 확인 → 탭 → 브라우저 로그인 → 앱 복귀 →
   게이트 사다리(동의→권한→본인인증→온보딩) 진입하면 성공.
3. 실패 시 백엔드 로그의 provider 응답(401/redirect_uri_mismatch)으로 콘솔 값 대조.
