# Docker (dev)

`docker-compose.yml`이 인프라(Postgres·Redis·LiveKit)와 앱(backend·web)을 관리한다. **모바일(Expo)은 도커 제외** — 호스트에서 `pnpm dev:mobile`.

두 가지 사용 방식:

## 1) 인프라만 (기본 — 앱은 호스트에서 `pnpm dev:*`)

```bash
docker compose up -d          # Postgres :5433 · Redis :6379 · LiveKit :7880
```

기존 워크플로 그대로. 이후 호스트에서 `pnpm dev:backend`, `pnpm dev:web`.

## 2) 풀스택 (앱까지 컨테이너)

`apps` 프로파일이 backend·web을 추가한다.

```bash
docker compose --profile apps up -d --build     # 최초/의존성 변경 시 --build
```

- **backend** → http://localhost:3000 (`nest start --watch`, 기동 시 `prisma migrate deploy` 자동)
- **web** → http://localhost:3100 (`next dev`)
- Postgres/Redis/LiveKit도 함께 뜬다(의존성).

**핫 리로드**: `apps/backend/src`·`apps/web/src`가 볼륨 마운트라 코드 수정 즉시 반영.
⚠️ `packages/shared`·`packages/client-core` 변경은 이미지에 컴파일돼 있으므로 **재빌드 필요**:
`docker compose --profile apps build`.

**dev 인증**: 컨테이너 backend는 `DEV_AUTH_ENABLED=true` + `IDENTITY_DEV_BYPASS=true`로 뜬다(소셜 전용 인증의 dev-login·본인인증 bypass 활성). compose env가 `apps/backend/.env`를 대체(마운트 안 함).

## 로그 / 정지 / 재빌드

```bash
docker compose --profile apps logs -f backend web    # 로그
docker compose --profile apps down                   # 정지(볼륨 유지)
docker compose --profile apps down -v                # 정지 + DB 볼륨 삭제
docker compose --profile apps build                  # 이미지 재빌드(deps·packages 변경 후)
```

## 주의

- **포트 충돌**: 호스트에서 이미 backend(:3000)/web(:3100)/Postgres 컨테이너가 떠 있으면 충돌한다. 호스트 프로세스나 기존 컨테이너를 먼저 내려라(`docker compose down`, host `pnpm dev` 중지).
- **모바일**: `apps/mobile/.env`의 `EXPO_PUBLIC_API_URL`은 컨테이너 backend를 실기기에서 볼 수 있게 LAN IP(예: `http://192.168.x.x:3000`)로. 시뮬레이터는 `localhost:3000`.
- 이미지는 `docker/Dockerfile.dev`(monorepo 전체 install + shared/client-core 빌드 + prisma generate). backend·web 공용.
