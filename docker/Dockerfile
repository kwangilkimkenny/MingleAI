# 운영용 @mingle/backend 이미지 (멀티스테이지).
#
# dev 이미지(Dockerfile.dev)와 다른 점: 핫리로드가 아니라 nest build 산출물을 node로 직접
# 실행하고, devDependencies는 최종 이미지에서 걷어내며, 기동 시 prisma migrate deploy를
# 먼저 돌린다(dev와 달리 새 마이그레이션을 만들지 않고 있는 것만 적용 — 멱등).
#
# 플랫폼 무관(Railway/Render/Fly/자체 서버 — Dockerfile을 받는 곳이면 어디든). 빌드 컨텍스트는
# 모노레포 루트: `docker build -f docker/Dockerfile -t mingles-backend .`
#
# ⚠️ 업로드(/uploads)는 컨테이너 로컬 디스크다. 재배포·스케일아웃 때 유실되므로 운영에서는
# apps/backend/uploads 에 영속 볼륨을 마운트하거나 객체 스토리지로 전환해야 한다(PLAY/LAUNCH 문서).
# ⚠️ 매칭 sweep·일부 게이트웨이 상태가 단일 인스턴스 전제 — Redis adapter 전까지 replicas=1.

# ---- builder: 전체 워크스페이스 설치 + 빌드 ----
FROM node:20-bookworm-slim AS builder

# openssl: Prisma generate가 libssl 버전을 감지해 맞는 쿼리 엔진을 생성(없으면 1.1.x로 오판).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10
WORKDIR /app

# 전체 워크스페이스 복사(.dockerignore가 node_modules/dist/tsbuildinfo 제외 → 리눅스에서 새로 설치).
COPY . .

# 전체 설치 — @mingle/* 내부 심링크와 bcrypt 네이티브 바인딩(빌드 스크립트)이 필요하다.
# --no-frozen-lockfile: 필터 설치가 client-core→shared 해석을 깨는 사례가 있어 전체 설치 유지.
RUN pnpm install --no-frozen-lockfile

# shared·client-core는 backend가 런타임 require(dual ESM/CJS) → 반드시 먼저 빌드.
# Prisma 클라이언트는 backend 컴파일 전에 생성해야 한다 — 코드가 Prisma.InputJsonValue 등
# 생성된 타입을 참조하므로 generate가 build보다 앞서야 tsc가 통과한다.
RUN pnpm --filter @mingle/shared build \
 && pnpm --filter @mingle/client-core build \
 && pnpm --filter @mingle/backend prisma:generate \
 && pnpm --filter @mingle/backend build

# ※ pnpm prune --prod는 쓰지 않는다 — 모노레포에서 @mingle/* 워크스페이스 심링크를 걷어내
#   backend의 런타임 require("@mingle/shared")가 깨진다(빌드 검증 2026-08-07). devDeps를
#   남겨 이미지가 커지는 대신 워크스페이스 해석이 확실하다.

# ---- runner: 빌드 산출물만 담은 최종 이미지 ----
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production
# dumb-init: PID 1 시그널 처리(정상 종료·좀비 프로세스 방지).
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init openssl \
 && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10
# 비루트 유저 먼저 생성 → COPY 시 소유권을 넘겨(Prisma가 런타임에 엔진 디렉터리에 써야 함).
RUN useradd -m -u 10001 app
WORKDIR /app

# 빌드된 워크스페이스 전체를 app 소유로 복사(prod+dev 의존성·dist·prisma 클라이언트·워크스페이스 dist).
# --chown: 추가 레이어 없이 소유권 이전. root 소유면 Prisma가 @prisma/engines에 못 써서 기동 실패.
COPY --chown=app:app --from=builder /app /app

USER app
# 업로드 디렉터리(볼륨 마운트 지점) — app 유저로 생성.
RUN mkdir -p /app/apps/backend/uploads

# 플랫폼이 주입하는 PORT를 존중(없으면 3000).
ENV PORT=3000
EXPOSE 3000

# 헬스체크 — /health는 인증·DB 없이 항상 200(liveness). readiness(/health/ready)는 DB를 친다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# 기동: 마이그레이션 적용(멱등) → 프로덕션 서버. cwd=apps/backend(uploads·schema 경로 기준).
CMD ["dumb-init","pnpm","--filter","@mingle/backend","start:container"]
