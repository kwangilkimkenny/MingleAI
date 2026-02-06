# MingleAI 서비스 진단 및 개발 계획

## 1. 현재 상태 진단

### 1.1 구현 완료된 기능 ✅

| 영역 | 기능 | 상태 |
|------|------|------|
| **인증** | 이메일/비밀번호 회원가입, JWT 로그인 | ✅ 완료 |
| **프로필** | 생성, 조회, 수정, 목록, AI 에이전트 페르소나 자동 생성 | ✅ 완료 |
| **파티** | 생성, 참가자 추가, 실행, 결과 조회 | ✅ 완료 |
| **리포트** | 매칭 점수 계산, 하이라이트, 추천 액션 | ✅ 완료 |
| **데이트 플랜** | 예산/위치 기반 코스 생성 | ✅ 완료 |
| **안전** | 콘텐츠 검사, 유저 신고, 자동 정지 | ✅ 완료 |
| **프론트엔드** | Next.js 15 + MUI v6 전체 UI | ✅ 완료 |
| **MCP 서버** | 기본 도구 15개 (프로필, 파티, 리포트, 데이트, 안전) | ✅ 완료 |

### 1.2 핵심 문제점 🔴

#### P0 (Critical)
1. **데이터베이스 이중화 문제**
   - Backend: PostgreSQL, MCP: SQLite
   - 데이터 동기화 없음 → 불일치 발생

2. **AI 통합 부재**
   - 파티 실행 시 실제 LLM 대화 없음 (Mock 데이터)
   - 매칭 점수가 하드코딩된 알고리즘

#### P1 (High)
3. **실제 장소 데이터 없음**
   - 데이트 플랜이 가상 템플릿 사용
   - 지도/장소 API 미연동

4. **안전 탐지 한계**
   - Regex 기반 (ML/NLP 없음)
   - 문맥 기반 사기 탐지 불가

#### P2 (Medium)
5. **에이전트 대화 로그 미노출**
   - 사용자가 에이전트 상호작용 확인 불가

6. **테스트 커버리지 부족**
   - E2E 테스트 없음

7. **개인정보 보호**
   - DB 평문 저장, 감사 로그 없음

---

## 2. 개선 개발 계획

### Phase 1: MCP 서버 고도화 (mingleai-mcp)

#### 1.1 백엔드 API 연동으로 전환
현재 MCP가 독립 SQLite를 사용하는 문제 해결

```
기존: MCP → SQLite (독립)
변경: MCP → Backend REST API → PostgreSQL
```

**새 MCP 아키텍처:**
```
packages/mingleai-mcp/
├── src/
│   ├── index.ts                 # MCP 서버 엔트리
│   ├── client/
│   │   └── api-client.ts        # Backend API 클라이언트
│   ├── tools/
│   │   ├── profile.tools.ts     # API 연동 버전
│   │   ├── party.tools.ts
│   │   ├── report.tools.ts
│   │   ├── date-plan.tools.ts
│   │   ├── safety.tools.ts
│   │   └── ai-conversation.tools.ts  # NEW: Claude 대화
│   ├── services/
│   │   ├── conversation.service.ts   # NEW: 에이전트 대화 시뮬레이션
│   │   ├── matching.service.ts       # NEW: AI 매칭 분석
│   │   └── venue.service.ts          # NEW: 장소 검색
│   └── config.ts
├── package.json
└── tsconfig.json
```

#### 1.2 새로운 MCP 도구 추가

| 도구 | 설명 | 우선순위 |
|------|------|----------|
| `simulate_agent_conversation` | Claude로 에이전트 간 실제 대화 생성 | P0 |
| `analyze_compatibility_deep` | AI 기반 심층 호환성 분석 | P0 |
| `generate_conversation_starters` | 맞춤형 대화 주제 추천 | P1 |
| `search_real_venues` | Kakao/Naver Maps 연동 장소 검색 | P1 |
| `get_conversation_logs` | 에이전트 대화 기록 조회 | P1 |
| `bulk_safety_scan` | 다중 프로필 안전 검사 | P2 |
| `get_platform_analytics` | 플랫폼 통계 조회 | P2 |

---

### Phase 2: AI 대화 시뮬레이션 엔진

파티 실행 시 실제 Claude API로 에이전트 대화 생성

#### 2.1 대화 시스템 설계

```typescript
// 에이전트 대화 플로우
interface AgentConversation {
  roundId: string;
  participants: AgentProfile[];
  messages: ConversationMessage[];
  analysis: ConversationAnalysis;
}

interface ConversationMessage {
  agentId: string;
  content: string;
  timestamp: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  topics: string[];
}

interface ConversationAnalysis {
  rapport: number;        // 0-1
  sharedInterests: string[];
  conversationFlow: 'natural' | 'awkward' | 'engaging';
  compatibility: number;  // 0-1
}
```

#### 2.2 Claude Prompt 설계

```
System: 당신은 "{name}"의 Another I 에이전트입니다.
{agentPersona}

상대방 에이전트: {partnerAgentPersona}

대화 상황: {icebreaker}
추천 주제: {topics}

규칙:
- 페르소나에 충실하게 대화하세요
- 개인 안전 정보는 공유하지 마세요
- 자연스럽고 진정성 있는 대화를 나누세요
- 상대방의 관심사에 질문하세요
```

---

### Phase 3: 외부 API 연동

#### 3.1 지도/장소 API (Kakao Maps)

```typescript
// 장소 검색 서비스
interface VenueSearchService {
  searchByKeyword(query: string, location: Location): Promise<Venue[]>;
  searchByCategory(category: VenueCategory, location: Location): Promise<Venue[]>;
  getRouteTime(from: Location, to: Location): Promise<number>;
}

interface Venue {
  id: string;
  name: string;
  category: VenueCategory;
  address: string;
  location: { lat: number; lng: number };
  rating: number;
  priceRange: 'low' | 'medium' | 'high';
  openingHours: string;
  photos: string[];
}
```

#### 3.2 연동 API 목록

| API | 용도 | 우선순위 |
|-----|------|----------|
| Kakao Maps API | 장소 검색, 경로 계산 | P1 |
| Naver Search API | 맛집/카페 정보 | P1 |
| OpenWeather API | 날씨 기반 코스 추천 | P2 |

---

### Phase 4: 안전 시스템 강화

#### 4.1 ML 기반 콘텐츠 모더레이션

```typescript
// 향상된 안전 검사
interface EnhancedSafetyService {
  // 기존 Regex + ML 하이브리드
  checkContent(content: string, context: SafetyContext): Promise<SafetyResult>;

  // NEW: 행동 패턴 분석
  analyzeUserBehavior(profileId: string): Promise<BehaviorAnalysis>;

  // NEW: 대화 맥락 기반 탐지
  analyzeConversation(messages: Message[]): Promise<ConversationSafetyResult>;
}

interface BehaviorAnalysis {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: BehaviorFlag[];
  recommendations: string[];
}
```

#### 4.2 자동 모더레이션 규칙

| 규칙 | 조건 | 액션 |
|------|------|------|
| 자동 경고 | riskScore >= 0.3 | 경고 메시지 발송 |
| 자동 제한 | riskScore >= 0.5 | 파티 참가 제한 |
| 자동 정지 | riskScore >= 0.7 | 계정 일시 정지 |
| 자동 차단 | 신고 3회 이상 | 계정 영구 정지 |

---

### Phase 5: 프론트엔드 고도화

#### 5.1 새 페이지/컴포넌트

| 페이지 | 설명 |
|--------|------|
| `/parties/[id]/conversations` | 에이전트 대화 로그 뷰어 |
| `/profile/[id]/agent` | 내 에이전트 설정/미리보기 |
| `/matches` | 매칭된 상대 목록 |
| `/messages` | 실제 유저 간 메시지 |

#### 5.2 UI 개선

- 실시간 파티 진행 상황 표시
- 대화 분석 시각화 (감정, 주제, 호환성)
- 데이트 코스 지도 표시

---

### Phase 6: 인프라 및 보안

#### 6.1 개인정보 보호

```typescript
// 필드 레벨 암호화
interface EncryptedProfile {
  id: string;
  userId: string;
  name: string;                    // 평문
  age: number;                     // 평문
  email_encrypted: string;         // AES-256 암호화
  phone_encrypted?: string;        // AES-256 암호화
  location_encrypted: string;      // AES-256 암호화
}
```

#### 6.2 감사 로그

```typescript
interface AuditLog {
  id: string;
  userId: string;
  action: 'read' | 'write' | 'delete' | 'export';
  resource: string;
  resourceId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}
```

---

## 3. 구현 우선순위 및 일정

### 즉시 착수 (Week 1-2)
1. **mingleai-mcp 신규 구현**
   - Backend API 클라이언트 구현
   - 기존 도구를 API 연동 버전으로 교체
   - 새 도구 스캐폴딩

### 단기 (Week 3-4)
2. **AI 대화 시뮬레이션**
   - Claude API 연동
   - 에이전트 대화 생성 로직
   - 대화 분석 및 점수화

### 중기 (Week 5-6)
3. **외부 API 연동**
   - Kakao Maps API 연동
   - 실제 장소 기반 데이트 플랜

### 장기 (Week 7-8)
4. **안전 시스템 강화**
   - ML 모델 통합
   - 행동 패턴 분석

---

## 4. mingleai-mcp 상세 설계

### 4.1 디렉토리 구조

```
packages/mingleai-mcp/
├── src/
│   ├── index.ts                    # MCP 서버 메인
│   ├── config.ts                   # 환경 설정
│   │
│   ├── client/
│   │   ├── api-client.ts           # Backend REST 클라이언트
│   │   ├── claude-client.ts        # Claude API 클라이언트
│   │   └── maps-client.ts          # Kakao Maps 클라이언트
│   │
│   ├── tools/
│   │   ├── index.ts                # 도구 등록
│   │   ├── auth.tools.ts           # 인증 도구
│   │   ├── profile.tools.ts        # 프로필 도구
│   │   ├── party.tools.ts          # 파티 도구
│   │   ├── conversation.tools.ts   # 대화 시뮬레이션 도구
│   │   ├── report.tools.ts         # 리포트 도구
│   │   ├── date-plan.tools.ts      # 데이트 플랜 도구
│   │   ├── venue.tools.ts          # 장소 검색 도구
│   │   ├── safety.tools.ts         # 안전 도구
│   │   └── analytics.tools.ts      # 분석 도구
│   │
│   ├── services/
│   │   ├── conversation.service.ts # 대화 생성 서비스
│   │   ├── matching.service.ts     # 매칭 분석 서비스
│   │   ├── venue.service.ts        # 장소 서비스
│   │   └── safety.service.ts       # 안전 서비스
│   │
│   └── types/
│       └── index.ts                # 타입 정의
│
├── package.json
├── tsconfig.json
└── README.md
```

### 4.2 MCP 도구 목록 (총 25개)

#### 인증 (2개)
| 도구명 | 설명 |
|--------|------|
| `auth_register` | 회원가입 |
| `auth_login` | 로그인 → JWT 토큰 반환 |

#### 프로필 (5개)
| 도구명 | 설명 |
|--------|------|
| `create_profile` | 프로필 생성 + 에이전트 페르소나 자동 생성 |
| `get_profile` | 프로필 조회 |
| `update_profile` | 프로필 수정 |
| `list_profiles` | 프로필 목록 (필터링) |
| `preview_agent_persona` | 에이전트 페르소나 미리보기 |

#### 파티 (5개)
| 도구명 | 설명 |
|--------|------|
| `create_party` | 파티 생성 |
| `add_participant` | 참가자 추가 |
| `run_party` | 파티 실행 (AI 대화 시뮬레이션 포함) |
| `get_party_results` | 파티 결과 조회 |
| `get_conversation_logs` | 에이전트 대화 로그 조회 |

#### 대화 시뮬레이션 (3개) - NEW
| 도구명 | 설명 |
|--------|------|
| `simulate_conversation` | 두 에이전트 간 대화 시뮬레이션 |
| `analyze_conversation` | 대화 분석 (호감도, 공통점, 분위기) |
| `generate_icebreaker` | 맞춤형 아이스브레이커 생성 |

#### 리포트 (3개)
| 도구명 | 설명 |
|--------|------|
| `generate_report` | 매칭 리포트 생성 |
| `get_report` | 리포트 조회 |
| `list_reports` | 리포트 목록 |

#### 데이트 플랜 (3개)
| 도구명 | 설명 |
|--------|------|
| `create_date_plan` | 데이트 코스 생성 |
| `get_date_plan` | 데이트 플랜 조회 |
| `search_venues` | 실제 장소 검색 (Kakao Maps) |

#### 안전 (3개)
| 도구명 | 설명 |
|--------|------|
| `check_content` | 콘텐츠 안전 검사 |
| `check_profile` | 프로필 안전 검사 |
| `report_user` | 유저 신고 |

#### 분석 (1개) - NEW
| 도구명 | 설명 |
|--------|------|
| `get_platform_stats` | 플랫폼 통계 (파티 수, 매칭 성공률 등) |

---

## 5. 예상 결과물

### 5.1 mingleai-mcp 완성 시
- Claude Desktop/Code에서 MingleAI 전체 기능 사용 가능
- 실제 AI 대화 시뮬레이션으로 현실감 있는 에이전트 상호작용
- 실제 장소 기반 데이트 코스 추천
- 통합된 안전 시스템

### 5.2 KPI
| 지표 | 현재 | 목표 |
|------|------|------|
| MCP 도구 수 | 15개 | 25개 |
| AI 대화 품질 | Mock | Claude 기반 |
| 장소 데이터 | 템플릿 | 실제 API |
| 데이터 일관성 | 이중화 | 단일 소스 |

---

## 6. 다음 단계

1. **mingleai-mcp 패키지 생성**
2. **Backend API 클라이언트 구현**
3. **기존 도구를 API 연동 버전으로 마이그레이션**
4. **새 AI 대화 도구 구현**
5. **테스트 및 문서화**
