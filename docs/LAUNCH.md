# MingleAI 출시 체크리스트 (2026-07-24 기준)

타깃: **내부 베타 우선**(EAS 빌드 → TestFlight·Google 내부테스트 → 실기기 검증 → 스토어 심사).
아래 A는 완료(레포에서 검증됨), B는 **운영자만 할 수 있는 일**(계정·계약·인프라), C는 베타 공지용 알려진 한계.

## A. 완료 — 레포에서 검증됨

- **품질 게이트**: production build·전체 테스트(backend 399+ / mobile 134 / client-core 80 / shared 41)·lint 경고 0 green.
- **DB**: 마이그레이션 전부 작성·로컬 적용(위치 매칭 컬럼 포함). 배포 시 `prisma migrate deploy`만.
- **핵심 루프 라이브 검증**: 6인(3:3) 매칭 → 스테이지 인트로("N라운드") → 3스테이지×3로테이션(랜덤 페어링) → 프로포즈 → 상호픽 Match+DM → 채팅방. 1:1 모드(`SPEEDDATE_GROUP_PER_GENDER=1`)도 검증.
- **미디어**: 웹 = LiveKit 실연동(FACE 카메라, DISGUISED 퍼블리셔측 피치 변조 — DSP 측정 검증). 네이티브 = `@livekit/react-native` 코드·플러그인·권한 완료(**동작 검증은 EAS dev build에서**, 런북 §7-3).
- **인증**: 소셜 전용(카카오·네이버·구글 어댑터, 키만 꽂으면 됨) + 본인인증 어댑터 seam + refresh token 로테이션(+client-core 401 자동 갱신) + granular 동의 + 카메라·마이크 게이트.
- **보안 기본기**: prod에서 dev-login·본인인증 bypass 강제 off, rate limit(전역+auth 강화), CORS allowlist env, 피어 프로젝션 리댁션(실명·연락처 비노출), 신고·차단.
- **운영도구**: 관리자 로그인 + 신고 모더레이션 웹(목록·상세·기각/경고/정지·복구) — 심사 시 UGC 모더레이션 체계 근거.
- **정책 페이지**: 웹 `privacy`·`terms`·`account-deletion` 라우트 존재(⚠️ 내용은 법무 검토 필요 — 초안 상태).
- **빌드 설정**: `apps/mobile/eas.json`(development/preview/production), app.json 번들ID(`com.mingleai.app`)·카메라/마이크/사진/위치 권한 문구·다크 스플래시·어댑티브 아이콘.
- **env 문서**: `apps/backend/.env.example`(전 키·기본값·[PROD] 표기), `apps/mobile/.env.example`.

## B. 운영자 체크리스트 — 순서대로

1. **EAS 계정 연결**: `npx eas-cli login` → `cd apps/mobile && npx eas-cli init` (projectId 발급 — push 알림에도 필수).
2. **개발자 계정**: Apple Developer Program($99/년), Google Play Console($25 1회).
3. **EAS dev build + 실기기 E2E**: `npx eas-cli build --profile development --platform ios`(및 android) → 실기기 2대로 런북 `docs/qa/2026-07-22-blind-speed-date-runbook.md` §4-3·§7 절차(네이티브 카메라/음성 첫 실검증 지점).
4. **소셜 로그인 실키**: 카카오·네이버·구글 개발자 콘솔에서 앱 생성 + redirect URI 등록 → backend `KAKAO/NAVER/GOOGLE_CLIENT_ID/SECRET`, 모바일 `EXPO_PUBLIC_*_CLIENT_ID`.
5. **본인인증 실계약**: PASS/포트원 등 본인확인 서비스 계약 → `auth/identity` 어댑터 seam에 실装(현재 `IDENTITY_DEV_BYPASS` 스텁). **데이팅 앱 특성상 심사·법무 관점 필수.**
6. **인프라**:
   - backend 호스팅 + Postgres + Redis(다중 인스턴스 시 socket.io redis-adapter 작업 필요 — 현재 단일 인스턴스 전제)
   - LiveKit: **LiveKit Cloud 권장**(자체 호스팅 대비 간단) → `LIVEKIT_URL/API_KEY/API_SECRET`
   - 도메인 + HTTPS, `PUBLIC_BASE_URL`, `SOCKET_CORS_ORIGINS`, `JWT_SECRET` 강한 값 교체
   - 업로드 스토리지: 현재 로컬 디스크(`uploads/`) — 규모 전 S3 계열 검토
7. **eas.json** preview/production의 `EXPO_PUBLIC_API_URL`을 실 API 도메인으로 교체.
8. **관리자 계정**: `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`(생성: `node -e "console.log(require('bcrypt').hashSync(process.argv[1],10))" '비밀번호'`).
9. **스토어 제출물**: 스크린샷(6.7"/6.1"/태블릿), 앱 설명, 연령 등급(데이팅 = 17+/18+), 개인정보처리방침 URL(웹 privacy 페이지 배포 후 URL — **법무 검토 후**), 데이팅 카테고리 심사 요건(UGC 신고·차단·모더레이션 운영 정책 설명 — A의 운영도구가 근거).
10. **베타 배포**: `eas build --profile preview` → TestFlight/내부 테스트 트랙 → 피드백 사이클 → `--profile production` + 심사 제출.

## C. 알려진 베타 한계 (테스터 공지용)

- **네이티브 가면 라운드(1라운드) = 음소거**: RN에 Web Audio가 없어 실변조 불가 → 원음 유출 대신 음소거로 가면 약속 유지(웹은 실변조). Phase E(네이티브 DSP 스파이크)가 해소 예정.
- 단일 서버 인스턴스 전제(매칭 sweep·게이트웨이 인메모리 상태) — 스케일아웃 전 redis-adapter 필요.
- 파티 게임("AI를 찾아라")은 의도적 비활성(`FEATURES.partyGame=false`) — 블라인드 데이트가 메인.
- 네이버 지도는 네이티브 빌드+`EXPO_PUBLIC_NAVER_MAP_KEY` 필요(웹 프리뷰는 OSM 대체 지도).
