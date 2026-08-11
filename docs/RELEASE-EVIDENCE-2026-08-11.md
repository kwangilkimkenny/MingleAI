# Mingles 출시 검증 기록 — 2026-08-11

기준 브랜치: `megahuni`  
최종 판정: **HOLD** — 코드·웹·네이티브 빌드는 통과했지만 운영 API와 사용자 도메인이 열리지 않았다.

## 통과한 항목

- `pnpm release:check`: 성공
  - lint: 전체 workspace 성공
  - tests: 562개 성공(shared 46, client-core 68, backend 341, mobile 107)
  - production dependency audit와 보안 회귀 테스트 성공
  - backend/web/shared/client-core 빌드 성공
  - 모바일 출시 환경 11개 검사와 Android 권한 manifest 검사 성공
- Expo Doctor: 21/21 성공
- Android Hermes production export: 성공
- Vercel production 배포: `dpl_HJEXa9SUrSwMNv24S6J8xnHfuVwb`
  - 배포 URL: `https://web-bn5iik1l6-megahuni.vercel.app`
  - HTTP 200, 브라우저 콘솔 오류 0, 데스크톱·모바일 접근성 트리 확인
  - `BACKEND_URL=https://api.mingles.cloud` rewrite 확인(`/api/health`가 동일한 upstream 502 반환)
- Android EAS preview: `37d5597d-70b7-4165-a340-6a1e4a7d51fc` (`ffe9c14`)
  - APK 생성 성공, SHA-256 `cf929465d30f545ca1907c8fe0cdf0c2c90b5d8e226cecf10e94afd4d59857f5`
  - API 36 Android emulator에 설치·기동 성공, MainActivity foreground 확인, fatal log 없음
- Android EAS production: `57f8f129-5417-44e6-addd-72d657e645d7` (`3fef7b8`)
  - versionCode 2 서명 AAB 생성 성공
  - ZIP 무결성과 JAR 서명 검증 성공, SHA-256 `5ae81f43e8fe29ccfa755becf4c5168f8008eae5029f07254fb6e5041b93addb`
  - API 복구와 Play Console internal listing 전에는 제출하지 않는다.
- iOS EAS simulator: `030ecd67-5dad-48a5-aa1a-60d6671818f7` (`ffe9c14`)
  - Xcode native compile 성공
  - `com.mingles.app`, arm64/x86_64 simulator binary, 비면제 암호화 사용 안 함 확인
  - 앱 binary에 `LKVoiceDisguiseProcessor`와 `setVoiceDisguiseEnabled` 포함 확인
  - iOS production은 원격 배포 인증서의 대화형 Apple 검증이 필요해 비대화형 빌드가 시작되지 않았다.
- Railway production 진단
  - Postgres 11개 migration 적용 완료
  - 502 직접 원인: PortOne/NICE 운영 본인인증 키 부재로 production 안전 게이트가 부팅 차단
- Railway production DB 논리 백업·복원 리허설
  - 읽기 전용 `pg_dump` SHA-256 `bb22c33d05ab59bfee4c018c2bc0c9c9f0ed79076250758ef9677d2431611bab`
  - PostgreSQL 18 임시 컨테이너 복원 성공: 완료 migration 11개, public table 17개, table-data entry 17개
  - 임시 컨테이너와 QA SSH 키는 검증 직후 제거했다. `/tmp` 산출물은 출시용 장기 백업이 아니므로
    실제 배포 직전 암호화된 보관소의 backup ID를 별도로 기록해야 한다.

## 완료를 막는 외부 항목

1. Gabia DNS에 `mingles.cloud`와 `www.mingles.cloud`의 Vercel 레코드를 등록해야 한다.
2. Railway에 실 PortOne V2 키 4개 또는 구현 완료된 NICE 계약 키를 등록해야 한다.
3. GitHub 조직/저장소 관리자가 결제 잠금을 해제하고 기본 브랜치·보호 규칙을 적용해야 한다.
4. App Store Connect/Play Console 상품과 제출 자격증명이 필요하다. Android 서명 AAB는 준비됐지만
   아직 internal track에 제출하지 않았다. 웹은
   `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL` 등록 즉시 CTA가 활성화된다.
5. 운영 API·LiveKit 복구 후 두 실기기에서 가입→본인인증→3개 로테이션→상호선택→채팅→신고/차단→탈퇴,
   음성 변조 음질·지연, 카메라·마이크·블루투스·백그라운드 복귀를 승인해야 한다.

## 운영 복구 후 실행 순서

1. DB backup ID를 기록하고 `prisma migrate status`를 다시 확인한다.
2. canary 1대에서 `/health`, `/health/ready`, 로그인·본인인증·매칭·채팅을 확인한다.
3. 내부 사용자 30분 관찰 후 전체 트래픽으로 확대한다.
4. 5xx, p95/p99, readiness, DB/Redis/LiveKit 경보를 의도적으로 한 번 발생시켜 수신자를 확인한다.
5. Android internal track와 TestFlight 설치 결과, 빌드 번호, Git SHA, 승인자를 이 문서에 추가한다.
