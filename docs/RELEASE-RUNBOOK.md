# mingles 배포·롤백 런북

최종 갱신: 2026-08-07. 모든 명령은 저장소 루트 기준이며 Node 20.18.1+와 pnpm 10.34.1을 사용한다.

## 1. 출시 승인 기준

아래 항목 중 하나라도 충족하지 못하면 배포하지 않는다.

1. 배포할 Git SHA의 GitHub `Release gate`가 전부 성공했다.
2. 로컬 `pnpm release:check`와 `pnpm --dir apps/mobile dlx expo-doctor@1.20.1`이 성공했다.
3. 운영 DB 백업, migration 상태, 복구 담당자와 복구 시점 목표를 기록했다.
4. EAS preview 실기기 핵심 여정과 권한 거부/복구 테스트가 통과했다.
5. 운영 API `/health`와 `/health/ready`가 성공하고 로그·경보 수신자가 확인됐다.
6. 개인정보 처리방침, 이용약관, 계정 삭제 URL과 스토어 Data safety/Privacy 답변이 법무·운영 승인을 받았다.
7. production 빌드가 EAS 원격 서명으로 생성됐고 내부 테스트 트랙에서 설치·실행됐다.

## 2. EAS 환경 준비

`EXPO_PUBLIC_*` 값은 앱 바이너리에 포함되는 공개 설정이다. 비밀 키는 절대 모바일 환경에 넣지 않고 backend에만 둔다.

```bash
cd apps/mobile
pnpm dlx eas-cli@21.7.0 login
pnpm dlx eas-cli@21.7.0 env:create --environment preview --name EXPO_PUBLIC_API_URL --value 'https://<YOUR_PREVIEW_API_HOST>' --visibility plaintext
pnpm dlx eas-cli@21.7.0 env:create --environment production --name EXPO_PUBLIC_API_URL --value 'https://<YOUR_PRODUCTION_API_HOST>' --visibility plaintext
pnpm dlx eas-cli@21.7.0 env:create --environment production --name EXPO_PUBLIC_KAKAO_CLIENT_ID --value REPLACE_WITH_PUBLIC_CLIENT_ID --visibility plaintext
pnpm dlx eas-cli@21.7.0 env:list --environment preview
pnpm dlx eas-cli@21.7.0 env:list --environment production
pnpm dlx eas-cli@21.7.0 config --platform android --profile production --json --non-interactive
```

예시 도메인과 `REPLACE_*` 값은 명령 템플릿일 뿐이며 실제 등록값으로 사용할 수 없다. 빌드 훅이 HTTP, localhost, 사설 IP와 예시 도메인을 거부한다. 네이버·구글을 제공하면 해당 `EXPO_PUBLIC_*_CLIENT_ID`도 같은 방식으로 등록한다.

## 3. backend production 환경

필수값은 `apps/backend/.env.example`을 기준으로 비밀 저장소에 등록한다. 최소 기준은 다음과 같다.

- `NODE_ENV=production`
- 강한 `JWT_SECRET`(32자 이상), 운영 `DATABASE_URL`, `REDIS_URL`
- HTTPS `PUBLIC_BASE_URL`, 명시적인 `SOCKET_CORS_ORIGINS`
- 실제 제공하는 소셜 provider의 backend Client ID/Secret
- 실제 본인확인 provider 설정. `DEV_AUTH_ENABLED`와 `IDENTITY_DEV_BYPASS`는 false 또는 미설정
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `ADMIN_EMAIL`, bcrypt `ADMIN_PASSWORD_HASH`
- push access token 및 업로드 영속 스토리지/볼륨

배포 전 production과 동일한 비밀 주입 방식으로 서버를 한 번 기동한다. 환경 검증 오류가 한 건이라도 있으면 중단한다.

## 4. DB migration

```bash
pnpm --filter @mingle/backend prisma:generate
pnpm --filter @mingle/backend exec prisma migrate status
pnpm --filter @mingle/backend exec prisma migrate deploy
pnpm --filter @mingle/backend exec prisma migrate status
```

순서:

1. 관리형 DB snapshot 또는 검증 가능한 논리 백업을 만들고 ID·시각·보관 위치를 기록한다.
2. 현재 앱과 직전 앱 모두 동작하는 additive migration인지 검토한다. 컬럼/테이블 삭제는 별도 데이터 보존 승인 없이는 실행하지 않는다.
3. canary backend 한 대에서 migration을 적용하고 readiness와 주요 query를 확인한다.
4. 실패 시 앱 배포를 중단한다. 이미 적용된 migration을 임의로 되돌리지 말고, 호환되는 직전 서버로 복귀하거나 검토된 forward-fix를 적용한다.

## 5. 빌드와 내부 배포

빌드는 깨끗한 커밋에서만 허용된다(`requireCommit: true`).

```bash
pnpm release:check
pnpm --dir apps/mobile dlx expo-doctor@1.20.1
cd apps/mobile
pnpm dlx eas-cli@21.7.0 build --platform all --profile preview
pnpm dlx eas-cli@21.7.0 build --platform android --profile production
pnpm dlx eas-cli@21.7.0 submit --platform android --profile production --latest
```

production Android 산출물은 `.aab`, 원격 signing credential, Google Play `internal` 트랙이어야 한다. 다운로드한 AAB는 `jarsigner -verify -verbose -certs app.aab`로 서명을 확인하고 EAS build ID, 앱 버전/빌드 번호, Git SHA, 내부 테스트 URL을 출시 기록에 남긴다. iOS도 production 빌드 후 TestFlight에서 같은 검증을 완료한 다음 심사 제출한다.

## 6. 실기기 필수 시나리오

- 신규 설치, 업데이트 설치, 로그아웃 후 재로그인, refresh token 만료/회전.
- 카메라·마이크·현재 위치·사진·알림: 최초 허용, 거부, 영구 거부, 설정에서 재허용.
- 가입, 만 19세/본인확인, 프로필 사진, 매칭 queue, 3단계 로테이션, 상호선택, DM 이미지, 알림 읽음 상태.
- 동일 계정 중복 요청, 상대 차단, 신고, 관리자 경고/정지/복구, 회원탈퇴.
- Wi-Fi↔셀룰러 전환, 일시적인 API/Redis/LiveKit 장애, 앱 백그라운드↔복귀.
- Android 저사양 기기와 최신 기기, 작은 화면/큰 글자, iPhone 작은 화면/노치 기기.

## 7. 스토어 권한·데이터 신고 기준

병합 Android manifest는 CI에서 아래 10개 권한 allowlist로 고정한다. 새 권한이 추가되면 출시 게이트가 실패하며 Data safety를 다시 검토해야 한다.

| 권한/데이터 | 실제 용도 | 저장 여부/주의 |
|---|---|---|
| 카메라·마이크·오디오 설정·Bluetooth | LiveKit 블라인드 데이트 | 실시간 중계, 녹화·녹음하지 않는다는 정책과 구현 일치 확인 |
| 대략적·정확한 현재 위치 | 거리 매칭·주변 장소 | 백그라운드 위치 없음. 위치 보관 기간과 삭제를 Data safety에 신고 |
| 사진 선택 | 프로필·DM 이미지 | Android 광범위 저장소 권한은 차단됨. 업로드 보관·삭제 정책 신고 |
| 알림 토큰·진동 | 매칭/메시지 push | 토큰을 계정 식별자와 연결해 처리함을 신고 |
| 계정·본인확인 정보 | 연령 확인·중복가입 방지·로그인 | 이름, 생년월일, 성별, 전화번호, CI, 소셜 식별자/이메일의 수집·보관·삭제 신고 |
| 프로필·선호·채팅·매칭·신고/차단 | 서비스 제공·안전 | 상대 공개 범위, moderation 접근, 탈퇴/법정 보존 기간 신고 |
| 네트워크·wake lock | 통화·실시간 서비스 안정성 | Android 일반 권한, 개인정보 수집 여부는 실제 로그 SDK 기준으로 별도 신고 |

`SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, 상시/백그라운드 위치, Motion, Face ID는 현재 제품 용도에 필요하지 않아 차단 또는 제거됐다.

## 8. 관측과 배포 후 확인

배포 전 운영 도구에서 다음 대시보드와 경보를 만들고 실제 수신 테스트를 한다.

- 1분/5분 HTTP 5xx 비율, p95/p99 응답시간, `/health/ready` 실패.
- 서버 재시작·uncaught exception, DB connection pool 고갈, migration 오류.
- Redis 연결 실패, speed-date queue 대기시간/세션 생성 실패, Socket.IO 재연결 급증.
- LiveKit token 발급/연결 실패, push ticket/receipt 오류, 업로드 실패.
- 로그인/refresh 실패율, 신고 처리 backlog, 관리자 정지/삭제 감사 로그.

canary 10분 → 내부 사용자 30분 → 전체 순으로 확대한다. 각 단계에서 핵심 API, 신규 가입, 매칭, 메시지, 알림을 확인한다.

## 9. 롤백

1. 신규 배포 트래픽을 중지하고 직전 검증 이미지/Git SHA로 backend를 복귀한다.
2. 향후 EAS Update를 활성화했다면 해당 channel을 직전 검증 update로 재지정한다. 현재처럼 네이티브 빌드만 배포할 때는 스토어 rollout을 즉시 중단하고 수정 빌드를 배포한다.
3. DB migration은 자동 down하지 않는다. 직전 서버가 새 schema와 호환되지 않으면 트래픽을 차단하고 검토된 forward-fix 또는 백업 복구를 선택한다.
4. `/health`, `/health/ready`, 로그인, 매칭, 채팅, LiveKit을 확인한 뒤 incident 시각·영향·조치·후속 작업을 기록한다.

## 10. 외부 승인 기록

출시 티켓에 다음을 첨부한다: Git SHA, CI URL, EAS build ID, 내부 테스트 승인자, DB backup ID, migration 출력, production 환경 변수 이름 목록(값 제외), 정책 URL, 스토어 Data safety/Privacy 캡처, 모니터링 경보 테스트, 롤백 담당자와 결과.
