# MingleAI

Another I 소셜 매칭 플랫폼 — AI 에이전트 기반 소셜 매칭 서비스

## 아키텍처

```
mingle-ai/
├── packages/
│   ├── shared/          # 공유 TypeScript 타입 (@mingle/shared)
│   └── mcp/             # MCP 서버 (@mingle/mcp)
├── apps/
│   └── backend/         # NestJS REST API (@mingle/backend)
├── docker-compose.yml   # PostgreSQL + Redis
└── pnpm-workspace.yaml
```

## 기술 스택

- **Runtime**: Node.js 18+
- **Package Manager**: pnpm (workspace)
- **Backend**: NestJS 10, Prisma ORM, PostgreSQL 15
- **인증**: JWT + Passport.js (bcrypt)
- **MCP Server**: @modelcontextprotocol/sdk, better-sqlite3
- **API 문서**: Swagger (http://localhost:3000/api)

## 시작하기

### 사전 요구사항

- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose

### 설치

```bash
# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example apps/backend/.env
# apps/backend/.env에서 DATABASE_URL, JWT_SECRET 수정

# Docker 서비스 기동
docker compose up -d

# DB 마이그레이션
cd apps/backend
npx prisma migrate dev

# 전체 빌드
cd ../..
pnpm build
```

### 실행

```bash
# 백엔드 개발 서버
pnpm dev:backend

# MCP 서버
pnpm dev:mcp
```

### 테스트

```bash
cd apps/backend
pnpm test          # 전체 테스트
pnpm test:cov      # 커버리지 포함
```

## API 엔드포인트

서버 기동 후 http://localhost:3000/api 에서 Swagger UI로 확인 가능합니다.

### Auth

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/auth/register` | 회원가입 (email, password) |
| POST | `/auth/login` | 로그인 → JWT 발급 |

### Profiles

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/profiles` | O | 프로필 생성 |
| GET | `/profiles` | - | 목록 조회 (필터: location, ageMin, ageMax, relationshipGoal) |
| GET | `/profiles/:id` | - | 단일 조회 |
| PATCH | `/profiles/:id` | O | 수정 (본인만) |

### Parties

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/parties` | O | 파티 생성 |
| GET | `/parties/:id` | - | 파티 조회 |
| POST | `/parties/:id/participants` | O | 참가 등록 |
| POST | `/parties/:id/run` | O | 파티 실행 (테이블 배정 + 매칭) |
| GET | `/parties/:id/results` | - | 결과 조회 |

### Reports

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/reports/generate` | O | 매칭 리포트 생성 |
| GET | `/reports/:id` | - | 리포트 조회 |
| GET | `/reports?profileId=xxx` | - | 프로필별 리포트 목록 |

### Date Plans

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/date-plans` | O | 데이트 코스 생성 |
| GET | `/date-plans/:id` | - | 코스 조회 |

### Safety

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/safety/check` | - | 텍스트 안전 검사 |
| POST | `/safety/report` | O | 유저 신고 |

### Health

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 헬스체크 |

## DB 스키마

7개 모델: User, Profile, Party, PartyParticipant, Report, DatePlan, SafetyReport

```bash
# Prisma Studio로 DB 탐색
cd apps/backend
npx prisma studio
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm build` | 전체 빌드 |
| `pnpm dev:backend` | 백엔드 개발 서버 |
| `pnpm dev:mcp` | MCP 서버 |
| `pnpm lint` | ESLint |
| `pnpm clean` | dist 정리 |

## 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | - |
| `JWT_SECRET` | JWT 서명 키 | - |
| `PORT` | 서버 포트 | 3000 |
