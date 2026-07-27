# 데이팅 앱 UX 리서치 — mingles 설계 참고

작성일 2026-07-27 · 목적: 실제 프로덕션 데이팅 앱들의 온보딩·홈·코어루프·매칭·수익화·안전 UX를 분석해 **mingles**(로테이션 블라인드 스피드데이트: 6인 매칭 → 3라운드 로테이션 음성/영상(가면·음성변조 → 실음성 → 얼굴공개) → 비공개 상호선택 → 매칭 → 1:1 채팅; 실명 본인인증 필수; 탭 = 홈·채팅·맛집예약·설정)의 설계 결정에 근거를 제공.

리서치 방법: 한국·영문 소스 병렬 조사(앱스토어/구글플레이 설명, 공식 헬프센터·보도자료, 나무위키, 언론, 실사용 후기 블로그). 재화 단가·무료 개수·타이머 수치는 앱이 수시로 바꾸고 A/B·지역차가 커서 "리서치 시점 기준"으로 읽을 것. 검증 실패 항목은 **미확인**으로 표기.

---

## 요약

1. **온보딩 순서에는 두 계열이 있다.** 글로벌 앱(틴더·범블·힌지·CMB)은 `인증(폰) → 프로필 → (선택)신원인증`으로 마찰을 최소화하고, 한국 앱(위피·정오의데이트·아만다)은 `본인인증(PASS) → 프로필/심사`로 신뢰를 먼저 세운다. 실명 인증이 법적·문화적으로 필수인 mingles는 후자 계열이 정답이지만, **무거운 게이트는 사용자가 가치를 본 뒤로 최대한 미루는** 것이 드롭오프를 줄인다.
2. **카메라·마이크 권한을 온보딩에서 하드 게이트로 걸면 이탈 위험이 크다.** 업계 정설은 "권한은 필요한 순간에, 사전 설명(priming)과 함께" 요청 — 지연 시 승인률이 최대 2배 [Appcues](https://www.appcues.com/blog/mobile-permission-priming).
3. **홈은 단일 CTA 허브가 정답.** 아만다·정오의데이트는 "하루 정해진 시각에 소수 소개", 틴더·범블은 스와이프 덱, 힌지는 프로필 피드, CMB는 하루 큐레이션 배치 — 공통점은 **핵심 행동 하나가 화면 중앙을 지배**한다는 것.
4. **탭은 3~5개, 코어 액션은 중앙/전면.** 5탭이 상한(틴더·위피). mingles의 4탭(홈·채팅·맛집예약·설정)은 적정하되 '맛집예약'은 데이팅 코어에서 이질적 — 성사 후 맥락으로 재배치 검토.
5. **점진적 공개(reveal-over-conversation)는 검증된 메커니즘.** S'More(사진 블러 → 15메시지 후 공개), JigTalk(얼굴 16조각 퍼즐 → 대화하며 제거), 화상 2분 블러 등 — mingles의 `DISGUISED → VOICE → FACE` 3단계는 글로벌 베스트프랙티스와 정합 [Datezie](https://www.datezie.com/smore-dating-app/), [Global Dating Insights](https://www.globaldatinginsights.com/news/jigtalk-puts-conversation-appearance-jigsaw-covered-profile-pictures/).
6. **라운드 타이머 업계 수렴점은 90초~3분** (Filter Off Events 90초, Tinder Speed Date 3분), 깊은 대화용은 4~10분. mingles의 현재 5분/라운드는 상단 — **3분 + 상호 opt-in 연장**을 검토할 근거 [The Sun](https://the-sun.com/lifestyle/9947893/ai-powered-dating-app-minutes-dates-virtual/amp), [Tinder Help](https://www.help.tinder.com/hc/en-us/articles/45177402513549-Speed-Date).
7. **"라운드 후 비공개 Like/Pass → 상호 시에만 매치"는 스피드데이트 표준.** Filter Off·Tinder Speed Date 공통 — mingles의 10초 비공개 상호선택은 여기에 결정 압박 타이머를 더한 변형(차별점) [DatingAdvice](https://www.datingadvice.com/online-dating/filter-off-connects-singles-through-video-speed-dates).
8. **성비·노쇼는 대기열(waitlist)로 관리한다.** Filter Off는 60/40 성비를 대기열로 강제 — mingles의 남3+여3 성별 인지 매칭과 같은 문제의식. 노쇼는 무료 이벤트에서 특히 크다는 게 정설 [getfilteroff](https://www.getfilteroff.com/run-video-speed-dating-event).
9. **매치 후 첫 메시지 마찰을 줄이는 장치가 성과를 낸다.** 힌지의 "특정 항목에 코멘트 붙인 좋아요"(응답률 3배), 범블 Opening Moves(미리 쓴 오프너) — 블라인드 대화 직후의 콜드오픈에 그대로 적용 가능 [dude-hack](https://dude-hack.com/how-does-hinge-work/), [TechCrunch](https://techcrunch.com/2024/04/30/bumbles-opening-move-feature-takes-the-pressure-off-women-to-come-up-with-a-new-message-every-time).
10. **한국 시장에 "라이브 로테이션 스피드데이트" 앱은 부재.** 목소리 우선(VoiceMate·데이톡)·얼굴 숨김(두두·커피한잔)은 있으나 "한 자리에서 여러 명 실시간 로테이션"은 확인되지 않음 — mingles의 정체성 루프가 국내 미개척 포지션.

---

## 앱별 분석

### A. 한국 주류 소개팅 앱

#### 아만다 (AMANDA) — 외모 심사 게이트의 원형
- **온보딩:** 사진 4장 + 기본정보 등록 → **기존 회원 실시간 평가 → 평점 3.0 이상이면 합격**(하드 게이트, 약 10분 소요) + PASS 본인확인 + 셀카 인증 → 인증 뱃지 [코스모폴리탄 체험기](https://www.cosmopolitan.co.kr/article/28034), [App Store](https://apps.apple.com/kr/app/id906675357). 단, 외모지상주의 비판 후 "3점 불합격 제도"를 **완화**한 이력(현재 알고리즘 미확인) [나무위키](https://namu.wiki/w/아만다(애플리케이션)).
- **홈:** 매일 저녁 8시 이상형 기준 **하루 2명** 소개(카드 큐레이션) + 익명 커뮤니티 "아만다 스퀘어".
- **코어루프:** 저녁 8시 소개 확인 → 좋아요(리본 소모) → 상호 매칭 시 대화. 거절 시 상대에게 알림 안 감(상처 방지).
- **수익화:** 재화=**리본**. 좋아요=5리본, **채팅 열기=30리본**, 30개 ₩4,400~ [코스모폴리탄](https://www.cosmopolitan.co.kr/article/28034). 무료 리본이 적어 "신규 회원 심사 노동"으로 재화 충당하게 되는 구조.
- **안전:** PASS+셀카 대조, 24시간 모니터링. 단 "평가 목적 유령회원"이라는 구조적 부작용.

#### 글램 (GLAM) — 사진 심사 + AI 매칭
- **온보딩:** 만 20세+ 가입 후 **프로필 사진 검수(기존 회원 평가로 임계 통과)**해야 이용 가능. 전화번호로 중복가입 차단. 실명 CI 필수 여부 미확인 [나무위키](https://namu.wiki/w/글램(애플리케이션)).
- **홈:** AI 매칭(좋아요·관심사·평가 데이터 학습), **프로필 무제한 무료 열람**, 별도 '글램 라이브'(영상/음성 실시간).
- **수익화:** 재화=**젬**. 특별추천 호감=5젬, 일반=15젬, **채팅 열기=30젬**(아만다와 동형) [소개팅어플 갤러리](https://m.dcinside.com/board/sogall/359). 2022.12 전면 유료화(1일 1회 무료 호감 폐지), 프로필 열람만 무료 유지.
- **안전:** 악성유저 탐지 알고리즘 + 24시간 검수 + ML 가짜 프로필 차단.

#### 위피 (WIPPY) — 본인인증 게이트가 가장 명확
- **온보딩:** 컨셉은 "동네 친구 소셜링". **PASS 신분증 검증 + 셀카 인증** → 본인 명의 휴대폰으로만 이용(한국 통신사 필요). 외모 심사 컷 없음 [위피 공식](https://wippy.io/), [App Store](https://apps.apple.com/kr/app/id1261209014).
- **홈:** **5탭 = 홈 / 라운지 / 위픽(WeePick) / 채팅 / 프로필.** 홈=오늘의 추천(무료 4명, 추가 유료), 라운지=동네 모임 콘텐츠, 위픽=상호 평가(Tinder식) 후 연결.
- **수익화:** 무료 추천 4명 초과·"나를 평가한 사람 보기"에 페이월. 재화 단가 미확인.
- **안전:** 이중 암호화 안심 채팅, 24시간 모니터링, AI 어뷰징 탐지. 규모 신뢰 시그널(누적 다운로드 1,000만+).

#### 틴더 코리아 — 한국 인증 스펙트럼의 아웃라이어
- **온보딩:** 폰/소셜 로그인 → 사진(≥1) + 바이오(400자 미만) + 기본정보 → 거리·연령 설정. **한국식 실명 PASS 인증 요구 안 함**(5개 앱 중 인증 최약). 2025년 **Face Check(라이브니스 셀카)를 신규 가입 필수화**(미국부터 확대) [Tinder Press](https://www.tinderpressroom.com/2025-10-22-Tinder-to-Expand-Facial-Verification-Feature-Across-the-U-S-,-Setting-a-New-Standard-for-Dating-Safety).
- **홈:** 풀스크린 **카드 스택 스와이프**(우=Like, 좌=Nope, 위=Super Like). 5탭 = 프로필·Explore·스와이프·Likes You·매치.
- **코어루프:** 스와이프 → 상호 Like → 매치 → 채팅. 무료 Like 하루 ~25~100개, **첫 스와이프로부터 12시간 후 리셋**(자정 아님) [cheaterbuster](https://www.cheaterbuster.com/blog/when-do-tinder-likes-reset).
- **수익화:** 구독 3단 — **Plus**(무제한 Like·Rewind·Passport) / **Gold**(+나를 좋아요한 사람·Top Picks·월 Boost) / **Platinum**(우선 Like·매치 전 메시지) [BeyondAges](https://beyondages.com/tinder-plus-vs-gold-vs-platinum/).
- **안전:** 사진 인증 뱃지 + ID 인증(일부 국가) + Face Check. 실명 인증 약해 국내 대비 위장 프로필 리뷰 많음.

#### 정오의데이트 — "정오 12시 하루 2명" 리듬
- **온보딩:** 약 14년 운영(누적 580만). **가입 심사 + 본인인증 + 정면 얼굴 사진 인증** 필수(측면·전체샷 불가) [appleboyit 사용법](https://appleboyit.com/65).
- **홈:** 코어=**"오늘의 카드"**(매일 정오 이상형 2명) + 라이브(접속자)·전체카드·놀이터(키워드 검색, 매칭률 순)·셀프소개팅. 허브+정오 알림 패턴.
- **코어루프:** 정오 2명 확인 → 관심(하트) → 상호 선택 시 "연결" → DM. 하루 단위 소개 대기.
- **수익화:** 재화=**캔디**. 프로필 열람=5캔디(~₩1,000), **채팅 시작=20캔디(~₩4,000)**, 하트=20캔디 [appleboyit](https://appleboyit.com/65). 열람~채팅 전 과정 과금이라 체감 비용 큼. Free Pass 구독(하트 무제한).
- **안전:** 가입 심사 + 본인인증 + 정면 얼굴 인증이 온보딩 관문.

### B. 한국 음성/블라인드 데이팅 앱

> **핵심 발견:** "목소리 우선"과 "얼굴 숨김"은 존재하나, **"한 자리에서 여러 명 실시간 로테이션"** 하는 국내 앱은 확인되지 않음 → mingles 차별점.

- **커넥팅(Connecting):** 6개 취향 선택 → 자동 매칭 → **통화 또는 텍스트**로 익명 대화, 좋으면 "채팅 신청". 로테이션 아닌 1:1 랜덤 반복 [App Store](https://apps.apple.com/kr/app/id1384259378). 사진·얼굴보다 대화/목소리 우선 — mingles와 철학 동일.
- **커피한잔:** 사진 없음 + **회사 이메일 인증 필수**(직장인 전용), "명함"에 회사·필명·기본정보 기재. 대학 인증 배지 추가 [뉴스와이어](https://www.newswire.co.kr/newsRead.php?no=1017779).
- **너랑나랑:** 매일 이성 16명 → **2지선다 × 8회 선택**으로 상호 선택 → 매칭 시 무료 채팅 [App Store](https://apps.apple.com/kr/app/id551321773).
- **VoiceMate / 데이톡 / 목소리톡:** 목소리 카드·음성 자기소개·오직 목소리 랜덤 채팅 계열(음성 우선) [VoiceMate](https://play.google.com/store/apps/details?id=dev.hayo.voicemate&hl=ko).
- **두두(DuDu):** 실물 사진 대신 **나를 닮은 AI 아바타**로 프로필 → 얼굴 공개 부담 없이 대화, Today Pick(하루 1명) [App Store](https://apps.apple.com/us/app/id6746435645). mingles의 아바타 단계와 유사.
- **블데(블라인드데이트):** 하루 ~10명 노출 제한 + 회사명 비공개 [Google Play](https://play.google.com/store/apps/details?id=mars.nomad.com.blinddate2018).
- **미확인(존재 검증 실패):** "눈맞춤", "살랑"은 신뢰 가능한 1차 소스 없음("살랑"은 직장인 앱 "일랑"의 오인 가능성) — 벤치마크 제외 권장.

### C. 글로벌 스피드데이트 / 블라인드 (mingles 직결 레퍼런스)

#### Filter Off — 화상 스피드데이트의 정석 ⭐
- **진입:** Events(지역 이벤트) / Matchmaker(주간 3명 페어링) / AI 자동(매일 밤 스케줄) 3모드. "프로필 말고 사람을 알아가라" 슬로건 [Product Hunt](https://www.producthunt.com/products/filter-off-3).
- **라운드/타이머(모드별):** Events **90초**/상대, Matchmaker 주간 **각 3분**, 표준 AI **4분**, Matchmaker Pro **10분**. 남은 시간 카운트다운 타이머 표시(압박감은 낮게 설계) [stylemyprofile](https://stylemyprofilenyc.com/filter-off-speed-dating-but-make-it-video/), [The Sun](https://the-sun.com/lifestyle/9947893/ai-powered-dating-app-minutes-dates-virtual/amp), [DatingAdvice](https://www.datingadvice.com/online-dating/filter-off-connects-singles-through-video-speed-dates). 이벤트 주최자가 데이트 수·길이 직접 조정.
- **결정 화면:** 각 데이트 종료 후 상대에게 **Like/Pass** → 다음 상대로 로테이션. 상호 Like면 매치 → 더 긴 화상/오프라인 약속.
- **성비/노쇼:** **대기열로 60/40 성비 유지**, 알고리즘이 불균형 감안해 배분 [getfilteroff](https://www.getfilteroff.com/run-video-speed-dating-event). 개별 노쇼 즉시 재매칭 세부 로직 미확인.
- **수익화:** 무료(일일 매치 제한) / 프리미엄 $9.99~$29.99/월 / Matchmaker Pro $397/월(전담 인간 매치메이커) [datinghunt](https://datinghunt.net/filteroff-review/).

#### Tinder Speed Date (2026 신기능) — 대형 플레이어의 수렴점 ⭐
- **연속 3분 1:1 화상 세션 → 3분 후 계속/패스 선택, 양쪽 opt-in 시 세션 연장.** 사진 인증 필수. Events 탭에서 진입, 세션은 별도 웹앱, 현재 LA 한정 [Tinder Help](https://www.help.tinder.com/hc/en-us/articles/45177402513549-Speed-Date), [TechCrunch](https://techcrunch.com/2026/03/12/tinder-tries-to-lure-people-back-to-online-dating-with-irl-events-virtual-speed-dating/). → **"3분 라운드 + 상호 연장"**이 최신 표준.

#### S'More — 대화하며 사진 공개
- 사진이 **블러로 시작 → 대화할수록 선명**. 정확히 **양방향 15메시지** 채우면 완전 공개, 화상도 **처음 2분 블러** [Datezie](https://www.datezie.com/smore-dating-app/). (2023년 Tawkify 인수 후 앱 종료.) → mingles 3단계 공개의 메시지-게이팅 버전.

#### JigTalk / Jigsaw — 얼굴 16조각 퍼즐
- 얼굴을 16조각으로 덮고 대화(메시지)마다 조각 제거, ~16메시지 후 완전 공개. 셀피·필터·신체정보 금지 [Global Dating Insights](https://www.globaldatinginsights.com/news/jigtalk-puts-conversation-appearance-jigsaw-covered-profile-pictures/). ⚠️ 사진 은닉형은 신원 확인 약화 지적 존재 [Medium](https://medium.com/@dateaha/photo-concealing-dating-platforms-have-a-big-safety-problem-13554d8debf8).

#### 기타 인접 앱
- **Blindmate:** 친구가 대신 매칭(매치메이커), 매치 후 blind chat에서 프로필 점진 공개 [FAQ](https://blindmate.app/faq/).
- **Snack:** TikTok식 세로 영상 프로필 피드(로테이션 아님), 36세 미만 [Distractify](https://www.distractify.com/p/how-does-snack-dating-app-work).
- **Feels:** 스토리형 프로필(스와이프 없이 이모지 반응) [Datezie](https://www.datezie.com/feels-dating-app/).
- **Willow:** 질문에 답하며 시작, 답 후에야 사진 공개(2015, 구식) [Time](https://time.com/3705332/meet-willow-the-dating-app-that-wont-judge-you-by-your-looks/).
- **미확인:** "Ready Set Date"는 1차 소스 확인 실패.

### D. 글로벌 주류

#### Tinder
- **온보딩:** 폰(6자리 SMS)/소셜 → 프로필 → 사진(≥1) → 거리·연령. 2025 Face Check 신규 필수화 [datinggroup](https://www.datinggroup.in/create-a-tinder-com-account/).
- **홈/루프:** 카드 스택. 무료 Like 하루 ~25~100(12h 리셋). 상호 Like → 매치 → 채팅(**둘 다 첫 메시지 가능, 시간 제한 없음, 매치 영구**) [greatist](https://greatist.com/live/reasons-your-tinder-match-never-messaged-you).
- **수익화:** Plus/Gold/Platinum + Boost·Super Like 단품.
- **안전:** 사진 인증 뱃지·ID 인증·Face Check(라이브니스).

#### Bumble — 여성 선메시지 + 24h 타이머
- **온보딩:** 폰/소셜 → 프로필·사진 → 모드(Date/Bizz, BFF는 별도 앱). Opening Move 설정은 선택.
- **핵심 메커니즘:** 이성 매치는 **여성이 24h 내 첫 메시지**(안 하면 매치 소멸), 이후 남성 24h 내 응답. **Opening Moves**로 여성이 오퍼너를 미리 작성해두면 매치가 답장 [TechCrunch](https://techcrunch.com/2024/04/30/bumbles-opening-move-feature-takes-the-pressure-off-women-to-come-up-with-a-new-message-every-time). 동성/논바이너리는 누구나 먼저.
- **수익화:** Boost(Extend·Backtrack·Spotlight·무제한 우측스와이프) / Premium(Beeline=나를 좋아요한 사람·인코그니토).
- **안전:** 셀피 포즈 인증(뱃지) + 2025 Veriff **ID 인증**(선택, 필터 가능) [TechCrunch](https://techcrunch.com/2025/03/17/bumble-heightens-safety-measures-with-new-id-verification-feature/).

#### Hinge — "삭제되도록 설계된" 프로필 중심
- **온보딩:** 폰/소셜 → 기본 → **사진/영상 6개 + 프롬프트 3개**(프로필 완성 게이트, 사실상 필수) [hinge help](https://help.hinge.co/hc/en-us/articles/10303221435539-What-is-Selfie-Verification).
- **홈:** 스와이프 아님 — **단일 프로필 스크롤 피드(Discover)**, 특정 사진/프롬프트에 좋아요. 탭 = Discover·Standouts·Likes You·Matches.
- **코어루프:** 무료 하루 8 좋아요 + 주 1 Rose. **좋아요에 코멘트 첨부 → 응답률 3배** [dude-hack](https://dude-hack.com/how-does-hinge-work/).
- **수익화:** Hinge+(전체 Likes You·무제한 좋아요) / HingeX(우선 좋아요) + Rose 단품.
- **안전:** 셀피/Face Check 인증(얼굴 기하 데이터 24h 후 삭제), 자동+수동 모더레이션. "Designed to be Deleted" 브랜딩.

#### Coffee Meets Bagel — 하루 큐레이션 배치
- **온보딩:** 폰(4자리)/페북 → 프로필 → 학력·직업·위치·데이트 대상 → 아이스브레이커. 사진 인증 선택.
- **홈/루프:** **하루 큐레이션 배치**(무한 덱 아님). 정오경 배치 제공(남 ~21명/여 ~6명), **24h 내 like/pass**. 탭 = Suggested·Discover·Likes You·Chats.
- **매치→채팅:** 상호 좋아요 → **~7일 채팅 창**(만료 메커니즘, 정확 일수 소스 불일치) + 아이스브레이커 제공.
- **수익화:** Premium(전체 Likes You·읽음 확인·활동 리포트) + Flowers(프리미엄 좋아요).
- **안전:** 페북+폰+선택 사진 인증(뱃지). 강제 ID/라이브니스 없음.

---

## 패턴 종합

### 온보딩 순서 — 지배적 패턴

| 계열 | 순서 | 대표 앱 | 특징 |
|---|---|---|---|
| **글로벌형(마찰 최소)** | 인증(폰) → 프로필 → (선택)신원인증 | 틴더·범블·힌지·CMB | 신원인증은 대부분 선택/사후, 즉시 사용 가능 |
| **한국형(신뢰 우선)** | 본인인증(PASS) → 프로필/심사 → 이용 | 위피·정오의데이트·아만다·글램 | 실명·얼굴 인증이 진입 관문(하드 게이트) |

- **온보딩 단계 수:** 글로벌은 4~6스텝(인증·기본정보·사진·프롬프트·선호), 한국형은 여기에 본인인증+사진심사가 추가돼 체감 단계가 더 김.
- **핵심 원칙(권한):** 카메라·마이크 등 OS 권한은 "필요한 순간에 사전 설명과 함께" 요청하는 것이 정설 — 지연·맥락화 시 승인률 최대 2배, 온보딩 초반 하드 요청은 드롭오프 유발 [Appcues](https://www.appcues.com/blog/mobile-permission-priming), [UserOnboard](https://www.useronboard.com/onboarding-ux-patterns/permission-priming/).

### 탭 구조 — 지배적 패턴

| 앱 | 탭 수 | 구성 |
|---|---|---|
| 틴더 | 5 | 프로필·Explore·스와이프·Likes You·매치 |
| 위피 | 5 | 홈·라운지·위픽·채팅·프로필 |
| 범블 | ~4 | 프로필·매치큐·스와이프·대화 |
| 힌지 | ~4 | Discover·Standouts·Likes You·매치 |
| CMB | 4 | Suggested·Discover·Likes You·Chats |

- **정설:** 3~5탭, 코어 액션(스와이프/피드/배치/매칭 CTA)이 화면 중앙 또는 전면. "Likes You/매치큐"류가 유료 전환 훅으로 항상 별도 탭.
- **mingles(홈·채팅·맛집예약·설정) 대비:** 4탭 자체는 적정. 단 '맛집예약'은 데이팅 코어 흐름 밖의 유틸이라, 대부분 앱이 이 자리에 두는 "Likes You/매치·발견"과 성격이 다름 → 성사 이후 맥락(매칭 후 데이트 장소 잡기)으로 위치 재고 권장.

### 스피드데이트 특화 인사이트

- **라운드 타이머:** Filter Off Events 90초 · Matchmaker 3분 · AI 4분 · Pro 10분, Tinder Speed Date 3분. → **90초~3분이 스위트스팟, 깊은 대화는 4~10분.** mingles 5분/라운드는 상단이라 조정 여지.
- **로테이션·라운드 사이:** 인원 불균형 시 짧은 대기 발생 가능, 라운드 전환은 **타이머/사운드 큐로 명확히 신호** [mixerseater](https://www.mixerseater.com/cms/how-to-organize-virtual-speed-dating-event). 자동 브레이크아웃 라우팅이 기술 난제 — mingles는 앱 네이티브로 이걸 해결하는 게 강점.
- **결정 화면:** "라운드 종료 → 비공개 Like/Pass → 상호 시에만 매치" 표준. Filter Off/Tinder는 결정에 별도 압박 타이머를 안 걸음 → mingles의 10초 강제 선택은 **긴장감 연출 vs 성급한 선택**의 트레이드오프(A/B 권장).
- **성비/노쇼:** **60/40 성비를 대기열로 유지**가 업계 권고, 무료 세션일수록 노쇼 큼 [getfilteroff](https://www.getfilteroff.com/run-video-speed-dating-event), [remo.co](https://remo.co/blog/virtual-speed-dating). mingles 남3+여3 정원 매칭은 정합하되, 미달 시 대기·부분정원 시작·AI 슬롯 폴백 정책 필요.
- **점진 공개 게이팅:** 시간 기반(mingles·Filter Off) vs 메시지 카운트 기반(S'More 15개·JigTalk 16개). mingles 3단계는 시간형 — 각 단계 시간이 "충분한 대화"를 담보하는지가 관건.

---

## mingles 권고 10선

**1. 게이트 사다리 순서를 "동의 → (권한 프라이밍) → 본인인증 → 프로필"로 정렬하고, 카메라·마이크 하드 게이트는 세션 직전으로 미뤄라.**
현재 팀리드가 공유한 순서(소셜로그인 → 본인인증 → 약관동의 → 카메라권한 → 온보딩)와 코드 실제(`nextGate`: 소셜 → 동의 → 권한 → 본인인증 → 프로필) 사이에 불일치가 있다. 법적으로 약관동의는 로그인 직후여야 하고, 카메라·마이크 권한을 온보딩 초반 하드 게이트로 걸면 "가치 확인 전 권한 요청"이라 드롭오프가 크다. 업계 정설은 권한을 **필요한 순간(첫 세션 진입 직전)에 사전 설명과 함께** 요청 시 승인률 최대 2배 [Appcues](https://www.appcues.com/blog/mobile-permission-priming), [UserOnboard](https://www.useronboard.com/onboarding-ux-patterns/permission-priming/). 권장 순서: **동의(법적) → 본인인증(실명, 한국형 신뢰 우선; 위피·정오의데이트 선례) → 프로필 → [세션 진입 시] 권한 프라이밍 화면 → OS 권한**.

**2. 온보딩 프로필 단계를 최소화하고 "얼굴 사진 요구"를 코어 컨셉과 맞게 축소하라.**
힌지는 사진 6장+프롬프트 3개를 요구해 완성 마찰이 크다. mingles는 얼굴을 마지막에 공개하는 블라인드 앱이므로 온보딩에서 얼굴 사진을 강제할 이유가 약하다. 정오의데이트가 "정면 얼굴 인증"을 관문으로 두는 것과 달리 [appleboyit](https://appleboyit.com/65), mingles는 **본인인증(실명/CI)으로 신원은 잡되 프로필 사진은 매칭 성사 후 DM에서만** 노출하는 현재 설계를 유지하고, 온보딩은 선호 신호+아바타 선택 중심의 3~4스텝으로 압축하라(두두의 AI 아바타 선례 [App Store](https://apps.apple.com/us/app/id6746435645)).

**3. 홈은 단일 MATCH CTA 허브로 만들고, 텍스트를 최소화하라.**
아만다(저녁 8시 2명)·정오의데이트(정오 2명)·CMB(하루 배치)·틴더(스와이프 덱) 모두 **핵심 행동 하나가 화면을 지배**한다. mingles 홈은 "지금 매칭 시작" 단일 primary CTA를 히어로로 두고, 최근 활동(채팅·프로포즈)은 하위 행으로. 이미 반영된 방향(홈 허브 + 블라인드 데이트 상단 히어로)을 유지하되, 설명 카피를 더 줄여 아이콘·상태 중심으로(사용자 규칙: less text).

**4. 라운드 타이머를 5분에서 3분(+상호 opt-in 연장)으로 재검토하라.**
업계 수렴점은 90초~3분(Filter Off Events 90초, **Tinder Speed Date 3분 + 양쪽 opt-in 연장**) [Tinder Help](https://www.help.tinder.com/hc/en-us/articles/45177402513549-Speed-Date), [stylemyprofile](https://stylemyprofilenyc.com/filter-off-speed-dating-but-make-it-video/). 5분×3라운드×3스테이지는 총 세션이 길어 이탈·노쇼 위험이 크다. **각 라운드 3분 기본 + "둘 다 좋으면 연장" 버튼**으로 하면, 짧은 회전율로 지루함을 줄이면서 케미가 좋은 페어에는 시간을 더 준다. 최소한 A/B로 3분 vs 5분을 비교하라.

**5. 점진적 공개(DISGUISED→VOICE→FACE)는 유지하되, 각 단계가 "충분한 대화량"을 담보하는지 검증하라.**
S'More(15메시지)·JigTalk(16메시지)는 공개를 **대화량(메시지 수)**에 연동해 "대화를 해야 공개된다"를 보장한다 [Datezie](https://www.datezie.com/smore-dating-app/), [Global Dating Insights](https://www.globaldatinginsights.com/news/jigtalk-puts-conversation-appearance-jigsaw-covered-profile-pictures/). mingles는 시간 기반이라 침묵해도 단계가 넘어간다. **각 스테이지에 최소 발화/상호작용 조건**(예: 양쪽 마이크 활성 시간)이 충족돼야 다음 공개로 넘어가는 소프트 게이트를 검토하라. 이 진행 방식은 이미 글로벌 베스트프랙티스와 정합하므로 컨셉 자체는 흔들지 말 것.

**6. 결정 화면은 "비공개 Like/Pass → 상호 시에만 매치" 표준을 따르되, 10초 강제 타이머는 A/B로 검증하라.**
Filter Off·Tinder Speed Date 모두 상호 Like 시에만 매치이며 **결정에 압박 타이머를 걸지 않는다** [DatingAdvice](https://www.datingadvice.com/online-dating/filter-off-connects-singles-through-video-speed-dates). mingles의 10초 비공개 상호선택은 긴장감이라는 장점이 있지만 성급한 Pass를 유발할 수 있다. 아만다처럼 **거절은 상대에게 알리지 않는**(상처 방지) 규칙 [코스모폴리탄](https://www.cosmopolitan.co.kr/article/28034)은 반드시 유지하고, 결정 타이머 길이(10초 vs 20~30초)는 매치율로 튜닝하라.

**7. 성비·정원·노쇼 정책을 대기열 기반으로 명문화하라.**
Filter Off는 **60/40 성비를 대기열로 강제**하고, 무료 세션의 노쇼가 크다는 게 업계 상식 [getfilteroff](https://www.getfilteroff.com/run-video-speed-dating-event), [remo.co](https://remo.co/blog/virtual-speed-dating). mingles 남3+여3 정원은 좋지만 미달 시 UX가 문제다. 권장: **(a) 대기 화면에 성별별 현재 인원·예상 시간 표시, (b) 정원 미달 지속 시 부분 정원(예 2+2) 시작 옵션 또는 AI 슬롯 폴백(dev의 `SPEEDDATE_AI_FILL` 확장), (c) 노쇼 발생 시 남은 라운드 자동 재편성 규칙**을 스펙에 명시.

**8. 매치 직후 첫 메시지 마찰을 없애는 오프너 장치를 넣어라.**
힌지의 "특정 항목에 코멘트 붙인 좋아요"는 응답률 3배 [dude-hack](https://dude-hack.com/how-does-hinge-work/), 범블 Opening Moves는 미리 쓴 오프너로 콜드오픈 부담을 제거한다 [TechCrunch](https://techcrunch.com/2024/04/30/bumbles-opening-move-feature-takes-the-pressure-off-women-to-come-up-with-a-new-message-every-time). mingles는 방금 3라운드 대화를 한 상대이므로 **세션 중 나눈 대화 소재(밸런스 답변·공통 관심)를 매치 후 DM 첫 화면에 "이 얘기 이어가기" 아이스브레이커로 자동 제시**하라. CMB의 아이스브레이커 제공 [App Store](https://apps.apple.com/us/app/coffee-meets-bagel-dating-app/id6502307144)와 같은 맥락.

**9. "다시 참여" 리텐션 훅을 정해진 리듬 + 즉시성 두 축으로 설계하라.**
아만다(저녁 8시)·정오의데이트(정오 12시)는 **정해진 시각 알림**으로 재방문 습관을 만든다. Filter Off는 매일 밤 자동 스케줄. mingles는 **(a) "오늘 저녁 8시 세션 열림" 같은 정기 세션 시간 + 푸시 알림**으로 기대감을 만들고, **(b) 아무 때나 큐에 들어가면 매칭되는 즉시 모드**를 병행하라. 세션 종료 화면에 "다음 세션 리마인드 켜기"와 "바로 한 번 더" CTA를 배치(현 chats/proposals 빈상태 CTA가 `/speed-date`로 가는 방향과 일치).

**10. 수익화는 한국식 "채팅당 재화" 함정을 피하고 "만남의 질"에 과금하라.**
아만다(채팅 30리본)·글램(30젬)·정오의데이트(채팅 20캔디)는 **대화 열 때마다 과금**해 체감 비용 불만이 크다("채팅 7번에 2만 원") [appleboyit](https://appleboyit.com/65). 반면 스피드데이트는 이미 매칭이 상호선택으로 검증돼 채팅당 과금이 불필요하다. 권장: **매칭·기본 채팅은 무료로 유지**하고, 과금은 (a) 세션 우선 입장/추가 세션권, (b) Filter Off식 프리미엄 매칭 큐, (c) 성사 후 데이트 장소(맛집예약) 부가가치 — '맛집예약' 탭을 여기에 연결하면 이질적 유틸이 수익화 동선으로 전환된다. 페이월은 "만나기까지의 질" 위에 두고, "만나는 행위 자체"에는 두지 말 것.

---

### 미확인·주의 항목
- 아만다 현재(완화 후) 심사 알고리즘, 글램 실명 CI 필수 여부, 각 앱 정확 온보딩 화면 수, 틴더 무료 Like 정확 개수, CMB 채팅 창 정확 일수(7 vs 8)·현재 재화명(Beans vs Flowers) — 소스별 편차.
- 존재 검증 실패(벤치마크 제외): "눈맞춤", "살랑", "Ready Set Date".
- 재화 단가·타이머·무료 개수는 앱 정책 변경·지역·A/B로 수시 변동 — 최종 결정 전 재확인 권장.
