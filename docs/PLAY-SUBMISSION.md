# Google Play 제출 패키지 — mingles

작성: 2026-08-07 · 코드에서 도출(추측 아님). 스키마·권한·외부 호출을 바꾸면 이 문서도 같은 커밋에서 갱신할 것.

앱: `com.mingles.app` · 카테고리: 데이팅 · 콘텐츠 등급: **성인(만 19세+)** · 판매자명: 등록 계정 유형에 따름(개인=실명 / 조직=상호).

---

## 1. 앱이 실제로 수집·처리하는 데이터 (Play Data safety 폼 매핑)

각 항목은 실제 수집 코드 위치를 근거로 한다. "수집 안 함"은 코드에 없다는 뜻.

| Play 데이터 유형 | 수집? | 근거(코드) | 목적 | 필수 | 제3자 공유 |
|---|---|---|---|---|---|
| 이름 | 예 | `Profile.name` | 앱 기능(프로필 표시) | 선택 | 매칭 상대에게만(별명→매치 후 실명) |
| 성별 | 예 | `Profile.gender` / `User.verifiedBirth·gender` | 성별 인지 매칭 | 필수 | 상대에게 |
| 나이/생년 | 예 | `User.verifiedBirth`, `Profile.age` | 연령 게이트(19+)·매칭 | 필수 | 나이만 상대에게 |
| 직업 | 예 | `Profile.occupation` | 프로필 | 필수 | 상대에게 |
| 자기소개 | 예 | `Profile.bio` | 프로필 | 선택 | 상대에게 |
| 사진 | 예 | `photoUrl`, 채팅 `direct_messages.image_url`(`/uploads/`) | 프로필·채팅 | 선택 | 매칭 상대에게 |
| 전화번호 | 예 | `User.phoneNumber`, 본인인증 | 본인확인·1인1계정 | 필수 | 본인확인 사업자에게(위탁) |
| 본인확인 CI | 예 | `User.identityCi` | 중복가입 방지·성인확인 | 필수 | 본인확인 사업자(생성원) |
| 이메일 | 조건부 | `User.email`(소셜이 주면) | 계정 식별 | 선택 | 소셜 로그인 제공자 |
| 대략/정확한 위치 | 예(선택) | `SpeedDateQueueEntry.lat/lng/radiusKm` | 거리 기반 매칭·맛집 추천 | **선택**(거부해도 매칭 가능) | 역지오코딩(OSM Nominatim)에 좌표 전송 |
| 메시지 | 예 | `direct_messages.content` | 1:1 채팅 | — | 매칭 상대에게 |
| 사진/영상(카메라) | 실시간만 | 스피드데이트 LiveKit | 얼굴 공개 라운드 | — | **저장 안 함**(녹화 없음, 실시간 스트림) |
| 음성(마이크) | 실시간만 | 스피드데이트 LiveKit | 음성 대화 | — | **저장 안 함** |
| 앱 활동(매칭·신고) | 예 | `Match`,`SafetyReport` | 매칭·안전 | — | 아니오 |
| 기기 ID/푸시 토큰 | 예 | `DeviceToken`(Expo push) | 알림 | 선택 | Expo 푸시 서비스 |

**중요 신고 포인트**
- **데이터 암호화 전송**: 예(HTTPS 강제, iOS ATS 잠금).
- **삭제 요청 수단**: 예 — 앱 내 설정 → 회원탈퇴(`DELETE /auth/account`), 웹 `/account-deletion` 안내.
- **광고·트래킹**: 없음(광고 SDK·트래커 미포함). 이 사실을 폼에 그대로.
- **데이터 판매**: 없음.

## 2. 제3자 데이터 수신처 (개인정보 처리방침 "위탁/제3자 제공"과 일치시킬 것)

코드에서 실제 호출하는 외부 서비스:

| 대상 | 보내는 것 | 용도 |
|---|---|---|
| 카카오/네이버/구글 | OAuth 코드·토큰 | 소셜 로그인 |
| 네이버 지역검색 API | 검색어(+동네명) | 맛집 추천 |
| OSM Nominatim | 좌표 또는 동네명 | 역/포워드 지오코딩 |
| OpenAI(LLM) | **익명화된** 최근 대화(나/상대 역할만, 이름·id 없음), 선호 문장 | 답변 추천·선호 분석 |
| LiveKit | 실시간 음성·영상 | 스피드데이트 미디어 |
| Expo Push | 푸시 토큰·알림 내용 | 알림 |
| 본인확인 사업자 | 이름·생년·성별·전화 | 본인인증(운영 연동 시) |

## 3. 권한 선언 (Play 민감 권한 심사 대비)

| 권한 | 선언 위치 | 사용자향 사유 | 언제 요청 |
|---|---|---|---|
| CAMERA | `app.json` android.permissions | 스피드데이트 얼굴 공개 라운드 | 세션 진입 직전(온보딩 아님) |
| RECORD_AUDIO | 〃 | 스피드데이트 음성 대화 | 세션 진입 직전 |
| 사진 접근 | expo-image-picker | 프로필/채팅 사진 선택 | 사진 첨부 시 |
| 위치(fine) | expo-location | 거리 기반 매칭·주변 맛집 | 반경 선택 시에만(선택) |
| 알림 | expo-notifications | 매칭·메시지 알림 | 최초 관련 이벤트 |

**차단한 권한**(Play가 좋게 봄): `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE`.
백그라운드 위치·상시 위치·동작·Face ID 설명 **없음**.

## 4. 스토어 등록 정보 초안

- **앱 이름**: mingles
- **짧은 설명(80자)**: 한자리에서 여러 사람과 돌아가며, 얼굴보다 대화로 먼저. 로테이션 블라인드 소개팅.
- **자세한 설명**: 남녀 3명씩 모이면 한 자리가 열립니다. 가면 대화(음성 변조) → 목소리 공개 → 얼굴 공개 순으로 단계적으로 열리고, 라운드가 끝나면 마음이 가는 한 사람을 비공개로 고릅니다. 서로 골랐을 때만 1:1 채팅이 열립니다. 본인인증을 마친 성인만 참여하며, 언제든 신고·차단할 수 있습니다.
- **콘텐츠 등급 설문**: 데이팅/사교, 사용자 간 소통 있음, 사용자 생성 콘텐츠(사진·메시지) 있음, 성인 대상 → **19세+**.
- **타깃 연령**: 만 19세 이상(앱이 본인인증으로 강제).

## 5. 출시 전 운영자 체크리스트 (계정·인프라 — 코드로 못 함)

- [ ] Google Play Console 등록($25 1회) + `com.mingles.app` 앱 생성.
- [ ] 운영 backend를 **HTTPS 도메인**에 배포(EAS `EXPO_PUBLIC_API_URL`이 가리킴). 이거 없으면 preview/production 빌드가 시작 단계에서 실패(release:validate).
- [ ] EAS 환경변수 등록: `EXPO_PUBLIC_API_URL`(https), 소셜 Client ID 최소 1개, `EXPO_PUBLIC_NAVER_MAP_KEY`(선택).
- [ ] `eas submit`용 Google 서비스 계정 JSON 발급(Play Console → API 액세스).
- [ ] 스크린샷(폰 최소 2장), 아이콘(512), 피처 그래픽(1024×500).
- [ ] Data safety 폼을 위 1절과 대조해 제출. 광고·판매 "없음" 정확히.
- [ ] 개인정보처리방침·이용약관 공개 URL(사업자명·연락처·보유기간 법무 검토 후).
- [ ] 본인확인 실사업자 연동(`IDENTITY_DEV_BYPASS`는 production 사용 불가).

## 6. 계정·인프라 준비되면 실행 (한 줄씩)

```bash
# 운영 URL·소셜키 등록(예시)
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://<운영도메인>
# production AAB 빌드(원격 서명 자동)
eas build --profile production --platform android
# Play internal 트랙 제출(서비스 계정 JSON 필요)
eas submit --profile production --platform android
```

내부 트랙 설치 확인 → closed testing → production 단계 승격.
