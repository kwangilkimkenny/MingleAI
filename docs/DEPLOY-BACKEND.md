# 운영 backend 배포 — mingles

작성: 2026-08-07. 아래는 **검증된 것**과 **운영자가 정할 것**을 나눈다. 프로덕션 이미지는
로컬에서 실제로 빌드·기동·헬스체크까지 통과 확인했다.

## 무엇이 준비됐나 (저장소)

- **`docker/Dockerfile`** — 멀티스테이지 운영 이미지. dev 이미지와 달리 nest build 산출물을
  node로 실행하고, 기동 시 `prisma migrate deploy`(멱등)를 먼저 돌린다. 비루트 유저,
  HEALTHCHECK 내장. 로컬 검증: 빌드 성공 → 컨테이너 `Up (healthy)` → `/health/ready` DB 쿼리 통과.
- **`apps/backend/.env.production.example`** — 코드가 실제로 읽는 모든 env(근거 기반).
- **Prisma binaryTargets** = `native` + `debian-openssl-3.0.x` + `linux-arm64-openssl-3.0.x`
  → 배포 아키텍처(amd64/arm64)와 무관하게 쿼리 엔진 매칭.
- 부팅 안전장치(코드): production에서 소셜 로그인 0개면 부팅 거부, `IDENTITY_DEV_BYPASS`·
  `SPEEDDATE_AI_FILL` 무시, `NSAllowsArbitraryLoads` 차단(모바일).

## 빌드·실행

```bash
# 빌드 컨텍스트 = 모노레포 루트
docker build -f docker/Dockerfile -t mingles-backend:prod .

# 배포 대상이 amd64인데 arm64 맥에서 빌드하면 플랫폼 지정:
docker buildx build --platform linux/amd64 -f docker/Dockerfile -t mingles-backend:prod .

docker run -d -p 3000:3000 --env-file apps/backend/.env.production mingles-backend:prod
```

기동 흐름: `migrate deploy`(대기 중 마이그레이션만 적용) → `node dist/main.js`. `/health`는
인증·DB 없이 liveness, `/health/ready`는 DB를 친다(readiness probe에 사용).

## 운영자가 정할 것 (코드로 못 하는 아키텍처 결정)

1. **호스팅 플랫폼** — Dockerfile을 받는 곳이면 무엇이든: Railway / Render / Fly.io / 자체 서버.
   - 플랫폼이 `PORT`를 주입하면 그 값을 쓴다(코드가 존중).
   - 헬스체크 경로: liveness `/health`, readiness `/health/ready`.
2. **Postgres** — 매니지드 권장(백업·PITR). `DATABASE_URL`에 DSN.
3. **Redis** — `REDIS_URL`. 미설정 시 인메모리 폴백이지만 재시작 시 상태 유실 + 다중 인스턴스 불가.
4. **업로드 영속화(중요)** — 업로드는 컨테이너 로컬 `apps/backend/uploads`에 쓴다. 재배포·
   스케일아웃 때 유실된다. 둘 중 하나 필수:
   - (a) 그 경로에 **영속 볼륨** 마운트 — 단일 인스턴스면 가장 간단.
     ⚠️ PaaS 볼륨은 **root:root 0755로 마운트**된다(Railway 실측 2026-08-10). 이미지가 비루트로
     돌면 업로드가 전부 EACCES. `docker/entrypoint.sh`가 root로 시작해 chown 후 setpriv로
     uid 10001로 내려가는 이유다 — 마운트 경로를 바꾸면 `UPLOAD_DIR`도 같이 넘겨야 한다.
   - (b) **객체 스토리지**(S3/R2 등)로 전환 — 다중 인스턴스·CDN 필요 시. 코드 변경 필요
     (`upload.controller.ts`가 현재 `fs.writeFile`). 다중 인스턴스 계획이면 이쪽.
5. **인스턴스 수 = 1** (당분간) — 매칭 sweep과 일부 게이트웨이 상태가 단일 서버 전제.
   수평 확장 전에 Socket.IO Redis adapter + 분산 작업 소유권이 필요하다.
6. **LiveKit** — 자체 호스팅 또는 LiveKit Cloud. `LIVEKIT_URL/API_KEY/API_SECRET`.
7. **HTTPS·도메인** — 도메인은 `mingles.cloud`(보유). DNS 배치:

   | 호스트 | 대상 | 용도 |
   |---|---|---|
   | `api.mingles.cloud` | backend 컨테이너(Railway 등) | REST + WebSocket |
   | `mingles.cloud`, `www` | apps/web(Next.js) | 소개·관리자 콘솔 |
   | (선택) `livekit.mingles.cloud` | 자체 호스팅 LiveKit | LiveKit Cloud 쓰면 불필요 |

   플랫폼에서 커스텀 도메인 추가 → 안내하는 CNAME을 등록사에 등록하면 TLS는 자동 발급된다.
   `PUBLIC_BASE_URL=https://api.mingles.cloud`, `SOCKET_CORS_ORIGINS`에 웹 오리진.
8. **DB 마이그레이션 운영** — 기동 시 자동 `migrate deploy`. 첫 배포 전 **백업 후**
   `prisma migrate status`로 정합 확인. 파괴적 마이그레이션은 별도 검토.

## 검증 방법(배포 후)

```bash
curl https://api.mingles.cloud/health          # {"status":"ok"}
curl https://api.mingles.cloud/health/ready    # {"status":"ready"} = DB 연결 정상
curl https://api.mingles.cloud/auth/social/providers   # 설정한 provider 목록
```

## 알려진 한계

- 이미지 ~1.6GB(워크스페이스 devDeps 포함 — pnpm prune이 @mingle/* 심링크를 깨서 미적용).
  추후 `pnpm deploy`로 슬림화 가능(정확성 우선으로 지금은 미적용).
- 정책 페이지 문구는 초안 — 법무 검토 후 공개 URL.
