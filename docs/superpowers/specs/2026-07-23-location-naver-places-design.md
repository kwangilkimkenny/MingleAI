# 위치 기반 매칭 + 네이버 맛집/예약 + 탭 재구성

- 날짜: 2026-07-23
- 상태: **P1–P5 구현 완료** (시맨). tsc(mobile+backend) clean · shared 41 · backend naver+speed-date 36 · mobile 127. 브라우저 검증: 4탭·반경 UI·naver-reserve(unconfigured graceful). **사용자 필요**: `prisma:migrate`(geo 컬럼 — 미적용 시 speed-date 큐 쿼리 실패) · 네이버 검색/지도 키 · EAS 빌드+deps 설치(expo-location·@mj-studio/react-native-naver-map).

## 결정 (사용자 확정)

- **지도/위치**: 네이버 지도 SDK(네이티브). Expo Go·웹 불가 → **EAS dev build(실기기)** 필요.
- **네이버예약 탭**: 실제 네이버 예약 공개 API 없음 → **네이버 지역검색(맛집) + 지도 표시 + 네이버
  플레이스/예약 페이지 딥링크**.
- **거리 필터**: **블라인드 데이트 큐**에 반경 필터(내 위치 기준 원형 반경).
- **탭**: `홈 · 채팅 · 네이버예약 · 설정` (프로포즈·알림 탭 제거). 프로포즈·알림은 **기능 유지**
  (탭에서만 제외 — `href:null`로 라우트 보존, 홈 허브 행에서 진입).

## 인프라/크리덴셜 (사용자 필요)

- 네이버 클라우드 플랫폼: **지도(Maps) 키** (지도 SDK).
- 네이버 개발자: **검색 API 키**(`X-Naver-Client-Id/Secret`) — 지역검색(맛집).
- **EAS dev build**(실기기) — 지도·GPS는 웹/시뮬레이터로 검증 불가.
- backend `.env`: `NAVER_SEARCH_CLIENT_ID/SECRET`, (지도 키는 클라 `EXPO_PUBLIC_NAVER_MAP_KEY`).
- Prisma 마이그레이션 apply(사용자 직접 — 권한 게이트).

## 아키텍처 — 시맨(seam)으로 키 없이도 테스트 가능

기존 OAuth/identity/media 시맨 패턴을 따른다. 키 미설정이면 501/스텁, 설정되면 실 fetch.

- **위치 시맨** `src/lib/location.ts`(+`.web.ts`): `expo-location` 권한/좌표. 웹은 stub 좌표.
- **네이버 검색 어댑터**(backend `naver/naver-search.service.ts`): `NAVER_SEARCH_*` 미설정 시
  501. 설정 시 지역검색 REST. jest는 목.
- **네이버 지도**(클라): `src/components/NaverMap.tsx`(+`.web.tsx` 폴백=리스트/플레이스홀더).
  네이티브만 실제 지도. 웹은 리스트.

## 데이터 모델

- `Profile` 또는 `SpeedDateQueueEntry`에 `lat`/`lng`(Float, nullable) + `radiusKm`(Int).
  블라인드 데이트 enqueue 시 좌표+반경 저장. 매칭 sweep에서 haversine으로 상호 반경 내만 페어링.
- 마이그레이션: 손수 SQL 불필요(단순 컬럼 추가) — `prisma migrate dev`.

## 게이트

- 위치 권한: 카메라·마이크 게이트와 별개 — **블라인드 데이트 진입 시** 요청(하드 게이트 아님;
  거부 시 반경 매칭 불가 안내). 온보딩 게이트 사다리엔 미포함(선택 권한).

## 페이즈

- **P1 (이번) — 탭 재구성**: `(tabs)/_layout` = 홈·채팅·네이버예약·설정 노출, 프로포즈·알림
  `href:null`(라우트 유지). `(tabs)/naver-reserve.tsx` 신설(현재 플레이스홀더 — 실 데이터는 P4).
  홈 허브 "최근"에 알림 행 추가(프로포즈 행 유지). **웹 테스트 가능.**
- **P2 — 위치 권한 + 시맨**: `expo-location` 추가, `location.ts` 시맨, 권한 요청 UI(블라인드
  데이트 진입). 웹 stub.
- **P3 — 거리 매칭(backend)**: 스키마 `lat/lng/radiusKm`, enqueue DTO 확장, sweep haversine
  필터, 스피드데이트 인트로에 **반경 슬라이더** UI. backend/mobile 테스트.
- **P4 — 네이버 맛집(검색)**: backend 네이버 지역검색 어댑터+엔드포인트(seam), `naver-reserve`
  화면 = 근처 맛집 리스트 + 네이버 딥링크. 웹=리스트로 검증(스텁/실키).
- **P5 — 네이버 지도(네이티브)**: 지도 SDK 의존성 + `NaverMap` 컴포넌트(웹 폴백), 반경 원
  오버레이·맛집 핀. **EAS 실기기 검증.**
- **P6 — 문서/정리**: CLAUDE.md(탭·env·시맨), 런북(키 발급·EAS), 메모리.

## 범위 밖 / 주의
- 실제 네이버 "예약" booking 연동 불가(공개 API 없음) — 딥링크까지만.
- 네이티브 지도·GPS는 실기기 전용. 지금 브라우저 E2E로는 P1~P4 로직만 검증.
