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

## 3. 구글 (console.cloud.google.com)

1. 프로젝트 생성 → OAuth 동의 화면(외부, 이메일·프로필 scope) 구성.
2. 사용자 인증 정보 → OAuth 클라이언트 ID 생성. **주의: 구글은 "웹 애플리케이션" 타입에
   커스텀 스킴 redirect를 허용하지 않는다** → iOS 타입(번들 ID) + Android 타입(패키지명+SHA-1)
   클라이언트를 만들고, 앱이 여는 authorize 요청의 클라이언트로 사용.
3. 키 반영:
   - 모바일 `.env`: `EXPO_PUBLIC_GOOGLE_CLIENT_ID=<iOS 또는 Android 클라이언트 ID>`
   - 백엔드 `.env`: `GOOGLE_CLIENT_ID=<동일>` / `GOOGLE_CLIENT_SECRET=<시크릿(웹/iOS 타입만 발급)>`

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
