# mingles 출시 체크리스트

최종 갱신: 2026-08-11
배포 전략: EAS preview → Android 내부 테스트/iOS TestFlight → 실기기 승인 → production 빌드 → 스토어 심사.

상세 명령, 장애 대응, 데이터·권한 신고 기준은 [RELEASE-RUNBOOK.md](./RELEASE-RUNBOOK.md)를 따른다.

## 저장소에서 자동 검증되는 항목

- `pnpm release:check`: production 의존성 audit, lint, 전체 test, 전체 build, 모바일 출시 설정·병합 권한 검사.
- GitHub `Release gate`: `megahuni` push 및 PR마다 위 품질 게이트, 깨끗한 Postgres에 `prisma migrate deploy/status`, Android JS export, secret scan 실행.
- EAS preview/production: EAS Environment에서 변수를 읽으며 저장소에 운영 URL을 하드코딩하지 않는다.
- EAS production: 원격 서명 자격증명과 Android App Bundle을 사용하고, submit은 먼저 Google Play `internal` 트랙으로 제한한다.
- 출시 환경 검증: HTTPS 공개 API URL과 최소 1개 소셜 로그인 Client ID가 없으면 EAS 빌드가 시작 단계에서 실패한다.
- 권한 최소화: Android 화면 오버레이·광범위 외부 저장소 권한 차단, iOS 임의 HTTP 허용 차단, 사용하지 않는 상시 위치·동작·Face ID 설명 제거.

## 출시 전 운영자가 완료해야 하는 항목

- [ ] EAS `preview`, `production` 환경 변수 등록 및 `eas env:list` 결과 확인.
- [ ] 운영 backend, Postgres, Redis, LiveKit, HTTPS 도메인과 업로드 영속 스토리지 준비.
- [ ] 운영 DB 백업 후 같은 커밋에서 `prisma migrate status`와 `prisma migrate deploy` 성공.
- [ ] 카카오·네이버·구글 중 실제 제공할 로그인 콘솔/redirect URI와 backend·mobile Client ID 일치 확인.
- [ ] 실 본인확인 사업자 연동. `IDENTITY_DEV_BYPASS`는 production에서 사용할 수 없다.
      공급자는 **하나만** 완비하면 운영 부팅이 열린다(2026-08-11).
      - **NICE 직계약**(선택한 경로): 계약 후 `NICE_CLIENT_ID` / `NICE_CLIENT_SECRET` /
        `NICE_PRODUCT_ID` / `NICE_RETURN_URL`. ⚠️ 코드는 `auth/identity/nice.provider.ts`에
        자리만 있고 **미구현** — 계약 규격(암호화 토큰·복호화 필드)을 받은 뒤 그 파일만 채우면 된다.
        실 키 없이 추측으로 쓰지 않았다. 동작하는 것처럼 보이는 본인인증이 제일 위험하다.
      - **PortOne V2**(대안): 구현·검증 완료. NICE 계약이 늦어지면 이쪽으로 먼저 열 수 있다.
- [ ] preview 빌드를 최소 Android 1대/iPhone 1대에 설치해 가입→본인확인→매칭→3개 라운드→상호선택→채팅→신고/차단→탈퇴를 검증.
- [ ] LiveKit 카메라·마이크, 블루투스 장치 전환, 백그라운드/복귀, 권한 거부·재허용을 실기기에서 검증.
- [ ] 개인정보 처리방침·이용약관의 사업자명, 연락처, 위탁사, 국외 이전, 보유기간을 법무 검토 후 공개 URL로 배포.
- [ ] Google Play Data safety/App Store Privacy 답변을 실제 운영 데이터 흐름과 대조하고 심사 제출물 준비.
- [ ] 오류 로그·가용성·5xx·DB·Redis·LiveKit 알림 수신자와 롤백 담당자를 지정한 뒤 모의 롤백 수행.
- [ ] 서명된 `.aab`/`.ipa`를 내부 트랙에 올리고 설치 가능한 빌드 번호와 Git SHA를 기록.

## 지금 운영(Railway) 상태 — 2026-08-11

- 프로젝트 `mingles` / 서비스 `mingles-api` / 도메인 `api.mingles.cloud`.
  (볼륨은 `mingleai-volume`로 남아 있다 — Railway가 볼륨 rename을 지원하지 않는다. 바꾸려면
  삭제·재생성뿐이고 그건 업로드 데이터 삭제라 미뤘다. 콘솔 내부 이름이라 사용자 노출은 없다.)
- ⚠️ **운영은 2026-08-10 배포에서 멈춰 있다.** 그 이후 모든 배포가 부팅 단계에서 거절된다:

      Error: An identity verification provider must be fully configured in production (PortOne or NICE)

  본인인증 키가 하나도 없기 때문이고, 이는 **의도된 방어**다(성인 확인 없는 소개팅 운영 금지).
  따라서 그 이후의 코드 변경 — 프로필 노출 차단, 성별 위조 차단, 첨부 URL 호스트 검증,
  소켓 토큰 갱신 — 은 **운영에 아직 반영되지 않았다**.
- Railway CLI로 재확인한 결과 Postgres의 **11개 migration은 모두 적용 완료**이고,
  `PORTONE_*`/`NICE_*` 환경 변수는 등록되어 있지 않다. DB 문제가 아니라 본인인증 운영 키 부재가
  502의 직접 원인이다. 가짜 키나 production 우회 플래그로 부팅하지 않는다.
- 실패 배포가 쌓이지 않게 **GitHub 자동배포를 꺼 뒀다**(Settings › Source › Auto deploy).
  본인인증 키를 넣은 뒤 다시 켜고 재배포하면 밀린 변경이 한 번에 올라간다.

## 알려진 출시 제약

- Android/iOS 모두 LiveKit 퍼블리셔 PCM 단계에서 음성 변조를 적용하며, 프로세서 설치가 실패하면
  원음 대신 마이크를 닫는 fail-closed 정책이다. Android preview APK와 iOS Simulator 앱의 원격
  네이티브 컴파일은 성공했다. 다만 실제 두 기기 사이의 변조 음질·지연 검증은 운영 API와 LiveKit이
  열린 뒤 별도 승인해야 한다.
- 매칭 sweep과 일부 gateway 상태가 단일 서버 인스턴스를 전제로 한다. 다중 인스턴스 전에는 Socket.IO Redis adapter와 분산 작업 소유권이 필요하다.
- 업로드가 로컬 디스크이면 재배포/스케일아웃 때 손실될 수 있으므로 production은 영속 볼륨 또는 객체 스토리지를 사용해야 한다.
- 정책 페이지의 문구는 제품 초안이며 법률 자문을 대체하지 않는다.
