# mingles 출시 체크리스트

최종 갱신: 2026-08-07
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
- [ ] preview 빌드를 최소 Android 1대/iPhone 1대에 설치해 가입→본인확인→매칭→3개 라운드→상호선택→채팅→신고/차단→탈퇴를 검증.
- [ ] LiveKit 카메라·마이크, 블루투스 장치 전환, 백그라운드/복귀, 권한 거부·재허용을 실기기에서 검증.
- [ ] 개인정보 처리방침·이용약관의 사업자명, 연락처, 위탁사, 국외 이전, 보유기간을 법무 검토 후 공개 URL로 배포.
- [ ] Google Play Data safety/App Store Privacy 답변을 실제 운영 데이터 흐름과 대조하고 심사 제출물 준비.
- [ ] 오류 로그·가용성·5xx·DB·Redis·LiveKit 알림 수신자와 롤백 담당자를 지정한 뒤 모의 롤백 수행.
- [ ] 서명된 `.aab`/`.ipa`를 내부 트랙에 올리고 설치 가능한 빌드 번호와 Git SHA를 기록.

## 알려진 출시 제약

- 네이티브 가면 라운드는 원음 유출 방지를 위해 음소거된다. 웹만 퍼블리셔 측 음성 변조를 제공한다.
- 매칭 sweep과 일부 gateway 상태가 단일 서버 인스턴스를 전제로 한다. 다중 인스턴스 전에는 Socket.IO Redis adapter와 분산 작업 소유권이 필요하다.
- 업로드가 로컬 디스크이면 재배포/스케일아웃 때 손실될 수 있으므로 production은 영속 볼륨 또는 객체 스토리지를 사용해야 한다.
- 정책 페이지의 문구는 제품 초안이며 법률 자문을 대체하지 않는다.
