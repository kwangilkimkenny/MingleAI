# 블라인드 스피드 데이트 — 셋업 & 실기기 런북 (2026-07-22)

Spec: `docs/superpowers/specs/2026-07-22-blind-speed-date-design.md`. 이 문서는 **사용자 머신에서만 가능한 단계**(마이그레이션 적용, LiveKit 서버, EAS dev build, 실기기 QA)를 다룬다. 코드/로직/테스트는 이미 브랜치에 있음(backend·shared·client-core·mobile 전부 그린).

## 지금까지 완료 (코드)

- shared: `buildRotationSchedule`, `projectPartner`/`stageReveal`, 스냅샷 타입 (+테스트)
- DB: `SpeedDateQueueEntry`/`SpeedDateSession` 모델 + partial-unique 마이그레이션 파일
- backend: `SpeedDateModule`(config·성별 매칭 sweep·세션 상태머신·LiveKit 토큰·gateway) + 34 spec, 전체 380/380
- client-core: `enqueueSpeedDate`/`cancelSpeedDate`/`getSpeedDateStatus` + `connectSpeedDateSocket`
- mobile: `app/(app)/speed-date/{index,[id]}.tsx`(동의→매칭→라운드→결정→결과), 홈 진입 카드, 세로, 미디어 seam(avatar 렌더)

## 1. DB 마이그레이션 적용 (사용자 직접 — `!` prefix)

권한 분류기가 `prisma migrate`를 차단하므로 직접 실행:

```
cd apps/backend
pnpm prisma:migrate         # 또는 배포 환경: pnpm exec prisma migrate deploy
```

마이그레이션 `20260722090000_speed_date`가 `speed_date_queue_entries`·`speed_date_sessions` 테이블 + partial-unique 인덱스를 만든다. (client은 이미 `pnpm prisma:generate` 완료.)

## 2. LiveKit 로컬 서버 (dev)

```
docker compose up -d livekit          # livekit-server --dev, ws://localhost:7880
```

backend `.env`에 추가:

```
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
SPEEDDATE_AI_FILL=true                 # 혼자 테스트: 부족한 3+3 슬롯을 AI로 채움 (dev 전용)
```

LiveKit env를 비우면 미디어 없이(아바타만) 로직 전체가 여전히 동작한다 — 매칭·로테이션·리빌 단계·결정·매치 생성까지 avatar로 검증 가능.

## 3. 혼자서 플로우 테스트 (미디어 없이)

1. backend 실행(`pnpm dev:backend`), `SPEEDDATE_AI_FILL=true`.
2. 앱에서 홈 → "블라인드 데이트 시작" → 동의 → 매칭. AI가 5슬롯을 채워 즉시 세션 형성.
3. preflight(20s) → FACE 라운드 3회(각 `SPEEDDATE_ROUND_MS`, dev는 짧게 낮춰도 됨) → 결정(10s) → 결과.
4. 상대 카드에서 "다시 대화하고 싶어요"로 선택. AI는 응답하지 않으므로 상호 매치는 실유저 2명(male+female)이 서로 고를 때 검증. 실유저 매치 검증은 실기기 2대(또는 2 세션)로.

**팁**: dev에서 라운드를 빠르게 보려면 `SPEEDDATE_ROUND_MS=15000 SPEEDDATE_PREFLIGHT_MS=5000`.

## 4. 모바일 실제 영상 (LiveKit) — EAS dev build 필요

Expo Go는 네이티브 WebRTC를 못 돌린다. 실제 영상은 EAS dev build.

### 4-1. deps 설치

```
cd apps/mobile
pnpm add @livekit/react-native @livekit/react-native-webrtc
pnpm add -D @livekit/react-native-expo-plugin @config-plugins/react-native-webrtc
```

`app.json` plugins에 추가(카메라/마이크 권한 문자열은 이미 있음):

```json
"plugins": [
  "@livekit/react-native-expo-plugin",
  "@config-plugins/react-native-webrtc",
  ... 기존 plugins ...
]
```

앱 엔트리(`app/_layout.tsx` 최상단)에서 한 번:

```ts
import { registerGlobals } from "@livekit/react-native";
registerGlobals();
```

### 4-2. 미디어 seam 교체 (단일 파일)

`src/lib/speed-date-media.ts`의 `useSpeedDateMedia`를 아래로 교체. 시그니처·반환 타입은 동일하므로 화면 코드는 안 바꿔도 된다.

```tsx
import { useEffect, useState } from "react";
import { Room, RoomEvent, Track } from "@livekit/react-native";
import type { SpeedDateRoomInfo } from "@mingle/client-core";

export type SpeedDateMediaStatus = "idle" | "connecting" | "connected" | "unavailable";
export interface SpeedDateMedia {
  status: SpeedDateMediaStatus;
  hasRemoteVideo: boolean;
  remoteVideoTrack: unknown | null;
}

export function useSpeedDateMedia(room: SpeedDateRoomInfo | null, publishVideo: boolean): SpeedDateMedia {
  const [state, setState] = useState<SpeedDateMedia>({ status: "idle", hasRemoteVideo: false, remoteVideoTrack: null });
  useEffect(() => {
    if (!room?.url || !room?.token) {
      setState({ status: "idle", hasRemoteVideo: false, remoteVideoTrack: null });
      return;
    }
    const r = new Room();
    let cancelled = false;
    setState((s) => ({ ...s, status: "connecting" }));
    const sync = () => {
      let track: unknown = null;
      r.remoteParticipants.forEach((p) => {
        const pub = p.getTrackPublication(Track.Source.Camera);
        if (pub?.videoTrack) track = pub.videoTrack;
      });
      setState({ status: "connected", hasRemoteVideo: !!track, remoteVideoTrack: track });
    };
    (async () => {
      await r.connect(room.url, room.token);
      if (cancelled) return void r.disconnect();
      await r.localParticipant.setMicrophoneEnabled(true);
      await r.localParticipant.setCameraEnabled(publishVideo); // camera only when the token allows it
      r.on(RoomEvent.TrackSubscribed, sync)
        .on(RoomEvent.TrackUnsubscribed, sync)
        .on(RoomEvent.ParticipantConnected, sync)
        .on(RoomEvent.ParticipantDisconnected, sync);
      sync();
    })().catch(() => setState({ status: "unavailable", hasRemoteVideo: false, remoteVideoTrack: null }));
    return () => {
      cancelled = true;
      r.disconnect();
    };
    // reconnect only when the ROOM changes (token refreshes every sweep but the room name is stable)
  }, [room?.room, publishVideo]);
  return state;
}
```

그리고 `app/(app)/speed-date/[id].tsx`의 `RoundView`에서 `hasRemoteVideo`일 때 `<VideoTrack trackRef={media.remoteVideoTrack as any} />`를 렌더(현재는 placeholder). `media`를 RoundView로 넘겨 track을 전달하면 된다.

### 4-3. EAS dev build + 실기기

```
cd apps/mobile
npx eas-cli build --profile development --platform ios   # 또는 android
```

실기기 2대(각각 male/female 프로필, 온보딩+선호분석 완료)로 동시에 큐 진입 → 세션 → 카메라 권한 허용 → FACE 라운드에서 상호 영상 확인 → 서로 선택 → 결과에서 "채팅 시작"이 DM 방으로 이동하는지 확인.

## 5. 프라이버시 경계 검증 (중요)

- DISGUISED/VOICE 단계에서 카메라가 **송출되지 않는지** LiveKit 대시보드/로그로 확인(토큰 grant `canPublishSources`가 `["microphone"]`뿐). UI 숨김이 아니라 발행 권한이 경계다.
- 스냅샷에 상대 실명/photoUrl이 절대 없는지(별명만). 실명은 매치 후 DM에서만.

## 7. 풀 3라운드 흐름 + 음성변조 (2026-07-24)

**흐름**(기본 `SPEEDDATE_STAGES=3`): `preflight`(조인) → **1라운드 안내**(`stage_intro`/DISGUISED, 카운트다운) → 상대 3명 로테이션(각 5분, 상단 타이머, 랜덤 페어링) → **2라운드 안내**(VOICE) → 3 로테이션 → **3라운드 안내**(FACE) → 3 로테이션 → **프로포즈**(`decision`, 10초 상호선택) → 상호픽 시 Match+DM.

### 7-1. 빠른 라이브 검증(구조·타이머·인트로)

backend `.env`에 짧은 타이밍(관찰용):
```
SPEEDDATE_STAGE_INTRO_MS=1500
SPEEDDATE_ROUND_MS=5000
SPEEDDATE_INTERMISSION_MS=1500
SPEEDDATE_PREFLIGHT_MS=2000
SPEEDDATE_DECISION_MS=3000
SPEEDDATE_AI_FILL=true
```
백엔드 재기동 후, 웹/실기기에서 큐 진입 → 인트로 화면("N라운드")·5초 카운트다운·상단 남은시간·상대 전환이 스테이지별로 도는지 확인. (백엔드 상태머신은 `speed-date.state.spec.ts`가 전 시퀀스를 결정적으로 검증.)

### 7-2. 웹 음성변조 + 카메라 리빌 검증

`docker compose up -d livekit` (devkey/secret) → 브라우저 2탭(male/female 각 온보딩 계정)으로 동시 큐 진입 → 같은 세션 매칭.
- **DISGUISED**(1라운드): 상대 목소리가 **피치 하강(변조)**으로 들림(`pitchRatio` 0.72).
- **VOICE**(2라운드): **원음**으로 전환(재발행 없이 워클릿 파라미터만 1.0).
- **FACE**(3라운드): 카메라 발행 → 상호 영상.
- 프라이버시: DISGUISED/VOICE에서 카메라 미발행(§5). 음성변조는 **퍼블리셔측**이라 원음이 상대에게 전송되지 않음.

### 7-3. 네이티브 실미디어 (Phase D/E — 미구현, 실기기 전용)

네이티브(iOS/Android)는 현재 **아바타 폴백**(seam `speed-date-media.ts` no-op). 실영상/실음성 = 다음 필요:
1. `pnpm --filter @mingle/mobile add @livekit/react-native @livekit/react-native-webrtc`
2. `app.json` config plugin + 카메라/마이크 권한 문구.
3. `speed-date-media.ts`를 guarded require(미설치=폴백)로 실제 LiveKit RN 구현(웹 seam과 동형), `VideoView.tsx` 네이티브 렌더.
4. `npx expo prebuild` → EAS dev build → 실기기 2대 §4-3 절차.
5. **네이티브 음성변조 = 스파이크**: react-native-webrtc는 커스텀 오디오 처리 미지원 → 네이티브 오디오 모듈 또는 LiveKit RN audio filter 조사 필요.

## 8. 남은 백로그 (슬라이스 밖)

- ~~Slice 2: VOICE + DISGUISED 단계~~ 완료(기본 3스테이지). ~~Slice 3: 웹 음성변조~~ 완료(퍼블리셔측 피치시프트). **네이티브 실미디어(§7-3)는 EAS 전용 미구현.**
- 예약형 런칭·성비 예측·대기자 승계. 논바이너리/다양한 조합. redis-adapter 다중 인스턴스. 중도 이탈 UI("상대가 나갔습니다") 정교화.
