# Android 릴리스 준비 QA 결과 — 2026-08-10

> 과거 시점의 QA 기록이다. 2026-08-12 PortOne 경로는 제거됐으며 현행 본인확인 공급자는 NICE
> 하나다. 현재 출시 게이트는 `docs/LAUNCH.md`를 따른다.

## 판정

- **Android 코드·빌드·로컬 통합 환경:** 조건부 GO
- **Google Play production 배포:** 운영 자격증명과 실서비스 canary 완료 전 HOLD
- **iOS:** HOLD — 음성 변조 네이티브 DSP가 Android에만 구현되어 있으며 iOS는 실패 차단 상태

코드 결함으로 확인된 P0/P1 항목은 수정했다. 남은 HOLD 항목은 저장소에서 생성할 수 없는 운영 비밀, 스토어 서명, 실제 통신 인프라와 법무 승인이다.

## 완료한 개발 항목

- PortOne 공식 SDK 기반 실명 인증, 사용자 결합 state/request ID, 서버 측 결과 재조회, CI 중복·성인 검증
- Android 발행 오디오 PCM 단계의 음성 변조와 원본 마이크 fallback 차단
- LiveKit 에뮬레이터 주소 변환과 고정 UDP 포트 설정
- 디자인 토큰, 4개 주 탭, 홈 허브, 온보딩, 로그인, 권한 안내, 대기열, 3단계 로테이션, 결과, 채팅, 장소, 알림, 설정 화면 정리
- 대기 인원·예상 시간·백그라운드 안내 및 API 15초 timeout/복구 메시지
- 대략적 위치 권한을 다시 요구하던 Android 권한 흐름 수정
- 상호 선택 후 채팅방 생성과 첫 메시지 흐름 검증용 QA 봇 확장
- Expo clean prebuild에서도 Gradle 8.13을 유지하는 config plugin
- `image-size`의 ICNS/HEIF/JXL 무한 루프 DoS 패치와 악성 입력 회귀 테스트

## 자동 검증 결과

| 게이트 | 결과 |
|---|---:|
| `pnpm release:check` | PASS |
| 워크스페이스 테스트 | 503/503 PASS |
| 보안 악성 입력 테스트 | 2/2 PASS |
| 모바일 릴리스 환경 테스트 | 10/10 PASS |
| lint | PASS, 경고 0 |
| 웹·백엔드·공유 패키지 production build | PASS |
| 모바일 권한 manifest | PASS, Android 권한 10개 검증 |
| Expo Doctor | 21/21 PASS |
| Android `assembleDebug` | PASS, 844 tasks |
| `git diff --check` | PASS |

테스트 중 출력된 404/403/429/500, push/LLM/network 경고는 예외 처리 테스트가 의도적으로 발생시킨 로그이며 실패 테스트는 없다.

## Android 에뮬레이터 실측

- Pixel 계열 Android 에뮬레이터에 최신 debug APK 재설치 및 Metro 연결 성공
- 로그인/온보딩/권한/홈/알림/채팅/장소/설정 화면 렌더링과 주 내비게이션 확인
- 대략적 위치 권한 승인 후 GPS 좌표 주입, 지도와 10km 범위 렌더링 확인
- 대기열 등록 `1/6`, 예상 대기 10분, 경과 시간, 취소 확인
- 실제 백엔드·Socket.IO·LiveKit과 QA 봇 5명을 사용해 6인 세션의 3단계 × 3라운드 진행 확인
- 변조 단계에서 LiveKit `연결 안정`, 마이크 활성화 확인
- 별도 상호 선택 시나리오에서 매칭 결과 → 채팅방 이동 → 상대 첫 메시지 수신 확인
- 최신 APK 재설치 후 홈과 장소 화면 재확인, 새 로그 구간에서 crash/JS fatal/native link 오류 0건

## production 배포 전 필수 외부 게이트

1. EAS production 환경에 공개 HTTPS API URL, 최소 1개 소셜 로그인 provider, Android 원격 서명 자격증명을 주입한다.
2. NICE 계약 규격에 맞는 provider·콜백 구현과 실키를 배포하고 production 기동 검사를 통과한다.
3. NICE 운영 또는 sandbox에서 실제 단말 본인 인증 성공·취소·중복 CI·미성년 차단을 1회씩 확인한다.
4. production LiveKit의 `wss://` signal과 TURN/UDP 경로를 통신사망 및 Wi-Fi 실기기에서 canary한다.
5. FCM 자격증명을 연결하고 잠금 화면/백그라운드/알림 탭 deep-link를 실제 Android 기기에서 확인한다.
6. 개인정보처리방침·이용약관·사업자 정보의 법무 승인과 Play Console 데이터 보안 양식을 완료한다.
7. 위 항목 완료 후 AAB 내부 테스트 → staged rollout 순으로 배포한다.

## 회귀 명령

```bash
pnpm release:check
pnpm --dir apps/mobile dlx expo-doctor@1.20.1

cd apps/mobile/android
MINGLE_JAVA='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
MINGLE_ANDROID_SDK='/Users/namuneulbo/Library/Android/sdk'
JAVA_HOME="$MINGLE_JAVA" \
ANDROID_HOME="$MINGLE_ANDROID_SDK" \
ANDROID_SDK_ROOT="$MINGLE_ANDROID_SDK" \
./gradlew assembleDebug
```
