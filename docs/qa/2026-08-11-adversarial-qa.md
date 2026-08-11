# 2026-08-11 제품 전수 QA — 비판적 관점 (mega-qa + 적대적 프로브 + UI 워크스루)

대상: 로컬 백엔드(:3000, Postgres :5433) + 모바일 웹 프리뷰(:8081). 실행 도구는
`tools/mega-qa.mjs`(해피패스 62체크) + 세션 스크래치패드의 적대적 프로브 3종(경계·권한·프라이버시)
+ 브라우저 수동 워크스루(가입 → 게이트 → 홈 → 탭 → 스피드데이트 진입).

## 요약

| 층 | 결과 |
|---|---|
| mega-qa 풀퍼널 | 62/62 PASS |
| 유닛(backend 295 · mobile 102 · shared/client-core) | 전부 PASS |
| tsc(전 패키지 + mobile) · lint | 0 |
| 적대적 프로브(90여 체크) | **제품 결함 9건** (P0 4 · P1 1 · P2 4) |
| UI 워크스루 | 크래시 1 · UX 결함 4 · 문서 드리프트 1 |

해피패스와 "설계된 거절"은 전부 정상이다. 결함은 **설계에 없던 경로**에 몰려 있다 —
매칭을 거치지 않고 프로필 API를 직접 부르는 경로, 클라이언트가 안 보내는 필드를 직접 보내는 경로.

---

## P0 — 블라인드 정체성이 API 한 번으로 무너진다

### 1. `GET /profiles/:id` — 아무 로그인 계정이나 임의 프로필 조회

```
stranger GET /profiles/6d236a70… → 200
{"id":"…","name":"피해자","age":25,"gender":"female","occupation":"회사원",
 "photoUrl":"http://localhost:3000/uploads/a06b6d77….png",
 "preferenceSummary":"차분한 분위기 · 천천히 알아가는 페이스 · …"}
```

매치도, 같은 세션도 아닌 제3자가 조회했다. 그리고 **스피드데이트 스냅샷은 파트너의
`profileId`를 그대로 준다**(`projectPartner` 화이트리스트에 포함). 즉 DISGUISED 라운드에서
소켓 스냅샷 → `GET /profiles/{partner.profileId}` 한 번이면 상대 사진·나이·직업이 나온다.

- LiveKit 발행 권한은 정확히 막고 있다(실측: DISGUISED/VOICE = `["microphone"]`, FACE =
  `["camera","microphone"]`). 서버가 카메라를 막는 동안 REST가 사진을 내주는 구조.
- 온보딩 3/3 화면이 사용자에게 하는 약속: **"이름과 사진은 얼굴 공개 전까지 숨겨져요."**

### 2. `GET /profiles` — 전 회원 열람/스크래핑

`?limit=50` 한 번에 타 회원 49명(닉네임·나이·성별·직업·사진·선호요약). 필터(location/age)까지 제공.

### 3. 업로드 사진은 무인증 공개

`/uploads/<uuid>.png` 직접 GET → 200 image/png. 추측 불가 UUID에만 의존하므로 1·2로 URL을
수집하면 그대로 영구 접근.

**권고(가장 짧은 수정):** `GET /profiles`와 `GET /profiles/:id`는 **클라이언트 어디서도 호출하지 않는다**
(`packages/client-core/src/api/profiles.ts`·`apps/web/src/lib/api/profiles.ts` 모두 `POST /profiles`만 사용).
v1 잔재이므로 **삭제**가 정답. 피어 정보는 이미 매치/DM(`toPeer`)과 세션 스냅샷이 각자 필요한 만큼만 준다.
삭제가 부담되면 "요청자와 매치가 성립한 프로필"만 통과시키는 가드를 붙일 것.

## P0 — 성별 위조로 반대 성별 큐 침투

`PATCH /profiles/:id`가 `age`/`gender`를 그대로 DB에 쓴다(`profile.service.ts` `update()`:
`if (dto.gender !== undefined) data.gender = dto.gender`). `create()`는 본인인증 값을 권위로
쓰는데 `update()`에는 그 규칙이 없다.

실측: 본인인증 male/28 계정 → `PATCH {gender:"female", age:21}` → 200, `/profiles/me`가
female/21, 이후 `POST /speed-date/queue` 201 `waiting`. 남3+여3 구성에서 여성 슬롯을 차지한다.

**권고:** `update()`에서 verified 값이 있으면 `dto.age`/`dto.gender`를 무시(또는 400).
`UpdateProfileDto`에서 두 필드 제거가 더 깔끔하다 — 앱 프로필 편집 화면에 나이·성별 입력이 없다.

## P1 — 채팅 첨부에 외부 도메인 URL이 통과한다

```
POST /messenger/rooms/:id/messages {"content":"","imageUrl":"https://evil.example.com/uploads/tracker.png"}
→ 201, imageUrl 그대로 저장
```

`normalizeAttachmentUrl`은 절대 URL을 `new URL(value).pathname`으로 바꿔 `/uploads/<name>`
정규식만 확인하고 **원본 URL(호스트 포함)을 반환**한다. 호스트 검증이 없다. 상대 앱이 이미지를
로드하는 순간 IP·열람 시각이 공격자 서버로 간다(추적 픽셀 = 스토킹 벡터).

**권고:** 절대 URL이면 호스트가 `PUBLIC_BASE_URL`(또는 요청 호스트)과 일치할 때만 통과,
아니면 pathname만 저장. traversal(`..`) 차단은 이미 정상 동작.

## P2 — 기능 결함

### 6. 동네 검색이 엉뚱한 지역을 준다

```
"성수동"      → {label:"성수동", detail:"하귀동남2길 · 하귀1리", lat:33.48079, lng:126.412743}  ← 제주 애월
"홍대입구역"  → 37.5567, 126.9237  (정상)
"강남역"      → 37.4999, 127.0269  (정상)
```

역 이름은 맞고 **행정동 이름이 틀린다**(서울 성수동은 OSM에 성수1가/2가동으로 있어 매칭 실패).
게다가 `detail`이 `display_name`의 2·3번째 조각만 쓰므로 **시/도가 안 보여** 사용자가 오지정을 알 수 없다.

**권고:** ① `detail`에 시/도를 포함(뒤에서 자르기), ② 네이버 지역검색(키 이미 보유)으로 폴백/보강.

### 7. 위치 미지정 상태의 장소 탭이 전국 결과를 뿌린다

"위치를 지정해 주세요" 상태에서 목록 10곳이 서울 중구·전북 군산·충남 천안·성남 분당으로 섞여 나오고,
정렬 pill은 `거리순`이 활성이다(기준 좌표 없음). 데이트 장소 탭의 목적과 정면으로 어긋난다.

**권고:** 위치 미지정이면 결과 대신 위치 지정 유도 `StateView`.

### 8. 지도 크래시(웹 프리뷰 전용)

동네를 고르고 장소 탭으로 돌아오면 화면 전체가 에러 바운더리로 떨어진다.

```
TypeError: Cannot read properties of undefined (reading 'layerPointToLatLng')
  at e.getBounds (leaflet@1.9.4)
  at drawOverlays (AppMap.web.tsx)
```

`AppMap.web.tsx:82` — `fitKm` 분기에서 `L.circle(...)`을 **`.addTo(map)` 없이** 만들고
`getBounds()`를 부른다. 지도에 붙지 않은 레이어는 `_map`이 없어 터진다.
네이티브 `AppMap.tsx`는 `zoomForRadius()`로 계산해서 무사하다.

**수정(1줄):** `map.fitBounds(L.latLng(center.lat, center.lng).toBounds(fitKm * 2000), { padding: [24,24] })`

### 9. 공백 닉네임 저장됨

`PATCH {name:"   "}` → 200, `name === "   "`. `UpdateProfileDto`의 `@IsNotEmpty()`는 공백 문자열을 통과시킨다.
**수정:** `@Transform(({value}) => value?.trim())` 또는 `@Matches(/\S/)`.

### 10. 장소 카드 중첩 Pressable

웹 콘솔: `<button> cannot contain a nested <button>` (PlaceCard 카드 Pressable 안에 예약 버튼 Pressable).
네이티브에서는 동작하지만 카드 탭과 버튼 탭의 히트박스가 겹친다.

---

## UX / 제품 관찰

- **카메라 권한을 세션 진입 시 필수로 받는다**(`ensureAvPermissions`는 camera+microphone 둘 다 요구).
  카메라는 3단계(FACE)에서만 쓰는데 1·2단계 진입도 막힌다. 마이크만 먼저 받고 FACE 직전에
  카메라를 요청하는 편이 드롭오프에 유리하다(권한 프라이밍을 온보딩 밖으로 뺀 것과 같은 논리).
- `/permissions` 화면에 뒤로/나중에 버튼이 없다(스택 back에만 의존).
- 알림 팝업이 열린 동안 하단 탭이 팝업에 덮여 탭 전환이 안 된다(백드롭 탭 닫기는 정상).
- 설정의 알림 토글 thumb 색이 팔레트 밖(웹 프리뷰).

## 문서 드리프트 (CLAUDE.md)

- 탭 = 홈·채팅·**장소**(라벨 표시됨). CLAUDE.md는 "홈·채팅·네이버예약·설정, 아이콘 전용".
- 홈 = 다크 정보형(워드마크·상태 카드·안전 블록). CLAUDE.md는 "카페 배경+캐릭터 레이어 드리프트".
  (2026-08-10 커밋 `0101f31`에서 홈이 전면 재작성됐고, 그 커밋 제목은 배포 수정이라 추적이 안 됐다.)

## 정상 확인(회귀 방지용 근거)

LiveKit 단계별 발행 권한 · 세션 스냅샷에 실명 없음 · 외부인 세션 join 거부 · 동성 선택 거부 ·
차단 양방향 강제 · 비멤버 방 접근 403 · 데이트플랜 역할 분리/실제 가게 5/5/코스 내 중복 없음/
확정 후 409/멱등 confirm · refresh 회전 및 옛 토큰 무효화 · logout 후 refresh 무효 ·
admin 라우트 401/403 · 업로드 매직바이트·5MB·traversal · reanalyze 5/min·report 10/min·social 20/min
레이트리밋 · 네이버 검색 캐시(cold 171ms → warm 3ms).

## 커버 못 한 범위

실기기 E2E(LiveKit 실미디어·네이티브 음성변조·푸시 콜드스타트), 실 OAuth 왕복(현재 dev-login),
실 본인인증(NICE 미계약 — dev bypass), 웹 관리자 콘솔 로그인(로컬 `.env`에 `ADMIN_EMAIL` 미설정).
