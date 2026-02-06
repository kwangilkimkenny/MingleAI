# @mingle/mingleai-mcp

MingleAI AI 소셜 매칭 플랫폼을 위한 MCP (Model Context Protocol) 서버입니다.

## 특징

- **Backend API 연동**: PostgreSQL 백엔드와 직접 통신 (데이터 일관성 보장)
- **30개 MCP 도구**: 인증, 프로필, 파티, AI 대화, 리포트, 데이트 플랜, 장소 검색, 안전 기능
- **JWT 인증**: 로그인 후 자동 토큰 관리
- **AI 대화 시뮬레이션**: Claude API로 에이전트 간 실제 대화 생성
- **실제 장소 검색**: Kakao Maps API 연동

## 설치

```bash
pnpm install
pnpm build
```

## 사용법

### Claude Desktop 설정

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mingleai": {
      "command": "node",
      "args": ["/path/to/MingleAI/packages/mingleai-mcp/dist/index.js"],
      "env": {
        "MINGLE_API_URL": "http://localhost:3000",
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "KAKAO_API_KEY": "your-kakao-api-key"
      }
    }
  }
}
```

### 환경 변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `MINGLE_API_URL` | Backend API URL | 기본: `http://localhost:3000` |
| `MINGLE_AUTH_TOKEN` | 사전 설정 JWT 토큰 | 선택 |
| `ANTHROPIC_API_KEY` | Claude API 키 (AI 대화 시뮬레이션) | AI 기능 사용 시 |
| `KAKAO_API_KEY` | Kakao Maps API 키 (장소 검색) | 장소 기능 사용 시 |

## MCP 도구 목록 (30개)

### 인증 (4개)

| 도구 | 설명 |
|------|------|
| `auth_register` | 회원가입 |
| `auth_login` | 로그인 |
| `auth_logout` | 로그아웃 |
| `auth_status` | 인증 상태 확인 |

### 프로필 (4개)

| 도구 | 설명 |
|------|------|
| `create_profile` | 프로필 생성 (에이전트 페르소나 자동 생성) |
| `get_profile` | 프로필 조회 |
| `update_profile` | 프로필 수정 |
| `list_profiles` | 프로필 목록 (필터링) |

### 파티 (5개)

| 도구 | 설명 |
|------|------|
| `create_party` | 에이전트 파티 생성 |
| `get_party` | 파티 정보 조회 |
| `add_participant` | 참가자 추가 |
| `run_party` | 파티 실행 |
| `get_party_results` | 파티 결과 조회 |

### AI 대화 (4개) ⚡ ANTHROPIC_API_KEY 필요

| 도구 | 설명 |
|------|------|
| `simulate_conversation` | 두 에이전트 간 대화 시뮬레이션 |
| `analyze_compatibility` | AI 호환성 심층 분석 |
| `generate_icebreaker` | 맞춤형 아이스브레이커 생성 |
| `suggest_message` | 대화 메시지 추천 |

### 리포트 (3개)

| 도구 | 설명 |
|------|------|
| `generate_report` | 매칭 리포트 생성 |
| `get_report` | 리포트 조회 |
| `list_reports` | 리포트 목록 |

### 데이트 플랜 (2개)

| 도구 | 설명 |
|------|------|
| `create_date_plan` | AI 데이트 코스 생성 |
| `get_date_plan` | 데이트 플랜 조회 |

### 장소 검색 (5개) ⚡ KAKAO_API_KEY 필요

| 도구 | 설명 |
|------|------|
| `search_venues` | 키워드로 장소 검색 |
| `search_nearby` | 주변 장소 검색 (카테고리별) |
| `recommend_date_spots` | 데이트 장소 추천 (음식점/카페/관광지) |
| `get_travel_time` | 두 지점 간 이동 시간 계산 |
| `geocode` | 주소를 좌표로 변환 |

### 안전 (3개)

| 도구 | 설명 |
|------|------|
| `check_content` | 콘텐츠 안전 검사 |
| `check_profile` | 프로필 안전 검사 |
| `report_user` | 유저 신고 |

## 사용 예시

### 1. 회원가입 및 로그인

```
User: MingleAI에 회원가입해줘. 이메일은 test@example.com, 비밀번호는 MyPass1234
Assistant: [auth_register 도구 호출]
→ 회원가입 및 자동 로그인 완료
```

### 2. AI 대화 시뮬레이션

```
User: 프로필 A와 B의 에이전트들이 대화하는 것을 시뮬레이션해줘
Assistant: [simulate_conversation 도구 호출]
→ 6개 메시지의 자연스러운 대화 생성
→ 호감도 75%, 호환성 80% 분석 결과 제공
```

### 3. 실제 장소 기반 데이트 추천

```
User: 강남에서 데이트하기 좋은 장소 추천해줘
Assistant: [recommend_date_spots 도구 호출]
→ 음식점 5개, 카페 5개, 관광명소 5개 실제 장소 추천
→ 주소, 전화번호, 거리 정보 포함
```

### 4. 호환성 분석

```
User: 두 프로필의 호환성을 분석해줘
Assistant: [analyze_compatibility 도구 호출]
→ 전체 점수: 78%
→ 가치관 85%, 라이프스타일 72%, 소통 80%, 케미 75%
→ 강점, 도전 과제, 조언 제공
```

## 카테고리 코드 (장소 검색용)

| 코드 | 설명 |
|------|------|
| `FD6` | 음식점 |
| `CE7` | 카페 |
| `AT4` | 관광명소 |
| `CT1` | 문화시설 |
| `AD5` | 숙박 |

## 개발

```bash
# 개발 모드 (watch)
pnpm dev

# 빌드
pnpm build

# 린트
pnpm lint
```

## 아키텍처

```
packages/mingleai-mcp/
├── src/
│   ├── index.ts           # MCP 서버 엔트리
│   ├── config.ts          # 환경 설정
│   ├── client/
│   │   ├── api-client.ts  # Backend REST API
│   │   ├── claude-client.ts # Claude AI API
│   │   └── maps-client.ts # Kakao Maps API
│   ├── tools/             # MCP 도구 (30개)
│   └── types/             # 타입 정의
```

## 라이선스

MIT
