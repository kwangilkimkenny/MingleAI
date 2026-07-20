# "AI를 찾아라" 게임 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어몽어스를 "AI를 찾아라"로 변형 — 인간 전원 크루, LLM 페르소나 AI 임포스터 2명이 잠입해 채팅·이동·킬·투표를 연기하고, 주기 자동 회의로 인간이 AI를 찾아낸다.

**Architecture:** among 자산(GameSession DB-as-state, advisory lock, 스윕, per-viewer 리댁션) 위에 구축. AI 봇 상태는 `AmongState.players[].isAi` + `state.ai` 블록으로 세션에 저장(재시작 내성). 봇 행동 결정은 순수 함수(`AiImpostorBrain.tick`) — 게이트웨이 스윕이 tx 안에서 실행하고 부수효과(이동 브로드캐스트·킬·투표·LLM 채팅)를 tx 밖에서 수행. 소켓 프로토콜 무변경(`party:moved`/`party:message` 재사용 — 클라는 미지 profileId 자동 등록).

**Tech Stack:** NestJS 10, Prisma, Socket.io, OpenAI-compat LLM(fetch), Expo RN, vitest/jest.

**스펙:** `docs/superpowers/specs/2026-07-20-find-the-ai-game-design.md`

## Global Constraints

- **임포스터 = AI 전용. 인간 역할 배정은 항상 crew** — 인간 임포스터 선출 코드 경로 완전 제거.
- 좌표·소켓 프로토콜 무변경(정규화 0..1 저장/전송, `party:move(d)`·`party:message`·`among:*` 이벤트 이름 불변). 게이트웨이 에러 이벤트는 `party:error`.
- `isAi`/`isBot`는 **플레이 중 스냅샷에 절대 미노출** — `isAi`는 ended 스냅샷에서만.
- env 계약(검증 기본값): `AMONG_AI_COUNT`(2)/`AMONG_AUTO_MEETING_MS`(120000)/`AMONG_AI_REQUIRE_LLM`(true)/`AMONG_AI_LLM_MAX_CALLS`(60)/`AMONG_AI_CHAT_MIN_MS`(60000)/`AMONG_AI_CHAT_MAX_MS`(90000). LLM 접속 = 기존 `LLM_API_URL`/`LLM_MODEL`/`LLM_API_KEY`/`LLM_CHAT_PATH`/`LLM_TIMEOUT_MS`.
- AI 발화: 길이 캡 120자, 게임당 LLM 호출 상한, 타임아웃/실패 시 `personas.ts` 템플릿 폴백. AI 채팅은 DB 미저장(브로드캐스트만).
- 빌드 순서 shared → client-core → apps; shared 수정 후 `pnpm --filter @mingle/shared build`.
- Prettier double quotes/trailingComma all/printWidth 100/semicolons. TS strict. mobile 테스트는 순수 lib vitest(node), RN import 금지. UI 이모지 금지(Lucide 아이콘). backend TS 에러 확인은 `"Found N error"` 문자열.
- 서버 인메모리 구조(인간 위치 맵·채팅 링버퍼)는 단일 인스턴스 전제 — 기존 스윕과 동일 제약, 주석 명시.
- 커밋은 한국어 conventional commit + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 트레일러.

---

### Task 1: shared — 타입 확장 + `worldDist` 승격

**Files:**
- Modify: `packages/shared/src/types/among.ts`
- Modify: `packages/shared/src/party-map/map.ts`
- Modify: `packages/shared/src/party-map/map.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: 기존 `WORLD_ASPECT`
- Produces:
  - `AmongMeetingView.reason: "report" | "emergency" | "auto"`
  - `AmongPlayerView.isAi?: boolean` (ended에서만 세팅된다는 계약 — 주석 명시)
  - `AmongSnapshot.nextAutoMeetingAt: number | null`
  - `worldDist(a: {x:number;y:number}, b: {x:number;y:number}): number` — world 계량(`hypot(dx×WORLD_ASPECT, dy)`) — 백엔드 AI 근접판정·모바일 공용

- [ ] **Step 1: 실패하는 테스트 — map.test.ts에 worldDist 케이스 추가**

`packages/shared/src/party-map/map.test.ts`의 import에 `worldDist` 추가 후 파일 끝에:

```ts
describe("worldDist", () => {
  it("y축은 그대로, x축은 aspect 배로 잰다", () => {
    expect(worldDist({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.3 })).toBeCloseTo(0.1, 10);
    expect(worldDist({ x: 0.2, y: 0.5 }, { x: 0.3, y: 0.5 })).toBeCloseTo(0.1 * WORLD_ASPECT, 10);
  });
  it("대칭이다", () => {
    const a = { x: 0.1, y: 0.2 };
    const b = { x: 0.4, y: 0.7 };
    expect(worldDist(a, b)).toBeCloseTo(worldDist(b, a), 10);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @mingle/shared test`
Expected: FAIL — `worldDist` export 없음.

- [ ] **Step 3: 구현**

`map.ts` 끝에 추가:

```ts
/** world 계량 거리 — 렌더 aspect-fit과 일치하는 등방 거리(모바일 판정·백엔드 AI 근접 공용). */
export function worldDist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot((b.x - a.x) * WORLD_ASPECT, b.y - a.y);
}
```

`types/among.ts` 수정 3곳:

```ts
// AmongMeetingView
  reason: "report" | "emergency" | "auto";

// AmongPlayerView — isAi는 게임 종료(ended) 스냅샷에서만 세팅된다(플레이 중 미노출 계약).
  isAi?: boolean;

// AmongSnapshot — 다음 자동(정기) 회의 예정 시각(epoch ms). 회의 중이거나 ended면 null.
  nextAutoMeetingAt: number | null;
```

`index.ts`의 party-map export 블록에 `worldDist` 추가.

- [ ] **Step 4: 통과 확인 + 빌드**

Run: `pnpm --filter @mingle/shared test` → PASS. `pnpm --filter @mingle/shared build` → 성공.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): AI를 찾아라 타입(reason auto·isAi·nextAutoMeetingAt) + worldDist 승격"
```

---

### Task 2: mobile — `worldDist`를 shared 재수출로 교체

**Files:**
- Modify: `apps/mobile/src/lib/party-space.ts`

**Interfaces:**
- Consumes: Task 1 `worldDist`
- Produces: `party-space.ts`의 `worldDist` export 유지(소비자 무변경) — 구현만 shared 위임

- [ ] **Step 1: 구현 (동작 동일 — 기존 테스트가 회귀 가드)**

`party-space.ts`에서 로컬 `worldDist` 함수 정의를 삭제하고 shared import/재수출로 교체:

```ts
import {
  PARTY_MAP,
  WORLD_ASPECT,
  CHAR_R,
  ROOM_MARGIN,
  solidFurniture,
  worldDist,
} from "@mingle/shared";
// ...
export { ROOM_MARGIN, WORLD_ASPECT, CHAR_R, worldDist };
```

(기존 `export function worldDist` 블록 삭제. 다른 코드 무변경.)

- [ ] **Step 2: 검증**

Run: `pnpm --filter @mingle/mobile test` → 전부 PASS(기존 worldDist 테스트가 재수출 검증).
Run: `cd apps/mobile && npx tsc --noEmit` → 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/party-space.ts
git commit -m "refactor(mobile): worldDist를 @mingle/shared로 위임 — 백엔드와 계량 단일화"
```

---

### Task 3: backend — among.config 확장

**Files:**
- Modify: `apps/backend/src/party/among.config.ts`
- Test: `apps/backend/src/party/among.config.spec.ts`

**Interfaces:**
- Produces: `AmongConfig`에 추가 — `aiCount: number; autoMeetingMs: number; aiRequireLlm: boolean; aiLlmMaxCalls: number; aiChatMinMs: number; aiChatMaxMs: number;`

- [ ] **Step 1: 실패하는 테스트**

`among.config.spec.ts`에 추가(기존 패턴 — `makeConfig`로 env 주입):

```ts
  it("AI 게임 기본값: aiCount=2, autoMeetingMs=120000, aiRequireLlm=true, maxCalls=60, chat 60~90s", () => {
    const p = new AmongConfigProvider(makeConfig({}));
    expect(p.value.aiCount).toBe(2);
    expect(p.value.autoMeetingMs).toBe(120000);
    expect(p.value.aiRequireLlm).toBe(true);
    expect(p.value.aiLlmMaxCalls).toBe(60);
    expect(p.value.aiChatMinMs).toBe(60000);
    expect(p.value.aiChatMaxMs).toBe(90000);
  });

  it("AMONG_AI_REQUIRE_LLM='false'만 false, 그 외 문자열은 기본 true", () => {
    expect(new AmongConfigProvider(makeConfig({ AMONG_AI_REQUIRE_LLM: "false" })).value.aiRequireLlm).toBe(false);
    expect(new AmongConfigProvider(makeConfig({ AMONG_AI_REQUIRE_LLM: "no" })).value.aiRequireLlm).toBe(true);
  });

  it("AMONG_AI_COUNT 범위 밖('0')은 기본 2로 클램프", () => {
    expect(new AmongConfigProvider(makeConfig({ AMONG_AI_COUNT: "0" })).value.aiCount).toBe(2);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @mingle/backend test -- among.config.spec` → FAIL.

- [ ] **Step 3: 구현**

`among.config.ts` — 인터페이스 필드 추가 + 생성자에:

```ts
function boolOr(raw: string | undefined, def: boolean): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return def;
}
// 생성자 value에 추가:
      aiCount: intOr(config.get("AMONG_AI_COUNT"), 2, { min: 1 }),
      autoMeetingMs: intOr(config.get("AMONG_AUTO_MEETING_MS"), 120000, { min: 10000 }),
      aiRequireLlm: boolOr(config.get("AMONG_AI_REQUIRE_LLM"), true),
      aiLlmMaxCalls: intOr(config.get("AMONG_AI_LLM_MAX_CALLS"), 60, { min: 0 }),
      aiChatMinMs: intOr(config.get("AMONG_AI_CHAT_MIN_MS"), 60000, { min: 1000 }),
      aiChatMaxMs: intOr(config.get("AMONG_AI_CHAT_MAX_MS"), 90000, { min: 1000 }),
```

(`aiLlmMaxCalls`는 `{ min: 0 }` — intOr의 min 파라미터로 0 허용됨을 확인: `intOr(raw, 60, { min: 0 })`.)

- [ ] **Step 4: 통과 + Commit**

Run: `pnpm --filter @mingle/backend test -- among.config.spec` → PASS.

```bash
git add apps/backend/src/party/among.config.ts apps/backend/src/party/among.config.spec.ts
git commit -m "feat(backend): AI를 찾아라 config — aiCount·autoMeeting·LLM 게이트·발화 주기"
```

---

### Task 4: backend — `personas.ts` (페르소나 풀 + 폴백 대사)

**Files:**
- Create: `apps/backend/src/party/ai/personas.ts`
- Test: `apps/backend/src/party/ai/personas.spec.ts`

**Interfaces:**
- Produces:
  - `interface AiPersona { profileId: string; name: string; age: number; gender: "male" | "female"; occupation: string; style: string; }`
  - `pickPersonas(count: number, takenNames: Set<string>, rand?: () => number, makeId?: () => string): AiPersona[]`
  - `fallbackLine(scene: "idle" | "meeting", rand?: () => number): string`
  - `AI_PROFILE_PREFIX = "ai-"`

- [ ] **Step 1: 실패하는 테스트**

`personas.spec.ts`:

```ts
import { pickPersonas, fallbackLine, AI_PROFILE_PREFIX } from "./personas";

describe("pickPersonas", () => {
  it("count만큼 뽑고 profileId는 ai- 접두 + 유일하다", () => {
    const ps = pickPersonas(2, new Set(), () => 0.42);
    expect(ps).toHaveLength(2);
    for (const p of ps) expect(p.profileId.startsWith(AI_PROFILE_PREFIX)).toBe(true);
    expect(new Set(ps.map((p) => p.profileId)).size).toBe(2);
    expect(new Set(ps.map((p) => p.name)).size).toBe(2);
  });

  it("takenNames와 겹치는 이름은 피한다", () => {
    const taken = new Set(["서지우"]);
    for (let i = 0; i < 20; i++) {
      const ps = pickPersonas(2, taken, () => i / 20);
      for (const p of ps) expect(taken.has(p.name)).toBe(false);
    }
  });

  it("주입 rand로 결정적이다", () => {
    const a = pickPersonas(2, new Set(), () => 0.3, () => "fixed");
    const b = pickPersonas(2, new Set(), () => 0.3, () => "fixed");
    expect(a.map((p) => p.name)).toEqual(b.map((p) => p.name));
  });
});

describe("fallbackLine", () => {
  it("scene별 풀에서 비어있지 않은 문장을 준다", () => {
    expect(fallbackLine("idle", () => 0.1).length).toBeGreaterThan(0);
    expect(fallbackLine("meeting", () => 0.9).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @mingle/backend test -- personas` → FAIL(모듈 없음).

- [ ] **Step 3: 구현**

```ts
import { randomUUID } from "node:crypto";

/**
 * AI 임포스터 페르소나 풀 — 게임 세션 안에서만 존재하는 가짜 프로필.
 * profileId는 "ai-" 접두 합성 ID(실 Profile 테이블에 없음 → 프로포즈/DM/신고 구조적 불가).
 */
export const AI_PROFILE_PREFIX = "ai-";

export interface AiPersona {
  profileId: string;
  name: string;
  age: number;
  gender: "male" | "female";
  occupation: string;
  /** LLM 프롬프트에 들어가는 말투/성격 한 줄. */
  style: string;
}

const POOL: Omit<AiPersona, "profileId">[] = [
  { name: "서지우", age: 27, gender: "female", occupation: "마케터", style: "말끝을 흐리며 ㅋㅋ를 자주 붙이는 무심한 말투" },
  { name: "한도윤", age: 29, gender: "male", occupation: "개발자", style: "짧고 건조하게 답하지만 가끔 드립을 치는 말투" },
  { name: "임채린", age: 26, gender: "female", occupation: "간호사", style: "리액션이 크고 이모티콘 없이도 텐션 높은 말투" },
  { name: "정하람", age: 31, gender: "male", occupation: "요리사", style: "느긋하고 존댓말 반말을 섞는 말투" },
  { name: "오세아", age: 28, gender: "female", occupation: "디자이너", style: "관찰평을 툭 던지는 시니컬한 말투" },
  { name: "강이준", age: 30, gender: "male", occupation: "트레이너", style: "단답 위주에 가끔 진지해지는 말투" },
  { name: "문가을", age: 25, gender: "female", occupation: "대학원생", style: "질문을 자주 던지는 호기심 많은 말투" },
  { name: "백시헌", age: 32, gender: "male", occupation: "회계사", style: "정중하지만 은근히 남 의심하는 말투" },
];

/** count명 추출 — takenNames(참가 인간 이름)와 충돌 회피, rand/makeId 주입으로 테스트 결정성. */
export function pickPersonas(
  count: number,
  takenNames: Set<string>,
  rand: () => number = Math.random,
  makeId: () => string = randomUUID,
): AiPersona[] {
  const candidates = POOL.filter((p) => !takenNames.has(p.name));
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, count).map((p) => ({ ...p, profileId: `${AI_PROFILE_PREFIX}${makeId()}` }));
}

const FALLBACK: Record<"idle" | "meeting", string[]> = {
  idle: [
    "여기 미션 은근 어렵네요",
    "다들 어디쪽에 있어요?",
    "아까부터 좀 조용하지 않아요?",
    "저 방금 미션 하나 끝냈어요",
    "누가 계속 따라오는 느낌인데 기분탓인가",
    "ㅋㅋ 조작 아직도 헷갈리네",
  ],
  meeting: [
    "저는 아까 계속 미션하고 있었어요",
    "움직임이 이상한 사람 있지 않았어요?",
    "일단 증거 없이 찍는 건 좀...",
    "저 아까 두 명이 같이 있는 거 봤어요",
    "스킵하고 좀 더 지켜보는 게 낫지 않아요?",
    "말 없는 사람이 제일 수상한데요",
  ],
};

/** LLM 실패/미설정 시 폴백 대사. */
export function fallbackLine(scene: "idle" | "meeting", rand: () => number = Math.random): string {
  const pool = FALLBACK[scene];
  return pool[Math.floor(rand() * pool.length) % pool.length]!;
}
```

- [ ] **Step 4: 통과 + Commit**

Run: `pnpm --filter @mingle/backend test -- personas` → PASS.

```bash
git add apps/backend/src/party/ai
git commit -m "feat(backend): AI 페르소나 풀 + 폴백 대사 — 결정적 추출(pickPersonas)"
```

---

### Task 5: backend — `AiChatClient` (LLM 발화/투표)

**Files:**
- Create: `apps/backend/src/party/ai/ai-chat.client.ts`
- Test: `apps/backend/src/party/ai/ai-chat.client.spec.ts`

**Interfaces:**
- Consumes: `AiPersona`(Task 4), 기존 LLM env(`LLM_API_URL`/`LLM_MODEL`/`LLM_API_KEY`/`LLM_CHAT_PATH`/`LLM_TIMEOUT_MS` — `ai.module.ts`와 동일 키)
- Produces:
  - `class AiChatClient { readonly enabled: boolean; say(ctx: AiSayContext): Promise<string | null>; pickVote(ctx: AiVoteContext): Promise<string | null>; }`
  - `interface AiSayContext { persona: AiPersona; scene: "idle" | "meeting"; recentChat: string[]; aliveNames: string[]; }`
  - `interface AiVoteContext { persona: AiPersona; recentChat: string[]; candidates: { profileId: string; name: string }[]; }`
  - `createAiChatClient(config: ConfigService): AiChatClient`

- [ ] **Step 1: 실패하는 테스트**

`ai-chat.client.spec.ts` (fetch 전역 목):

```ts
import { AiChatClient } from "./ai-chat.client";

const PERSONA = {
  profileId: "ai-x", name: "서지우", age: 27, gender: "female" as const,
  occupation: "마케터", style: "무심한 말투",
};
const CTX = { persona: PERSONA, scene: "idle" as const, recentChat: ["안녕하세요"], aliveNames: ["A", "B"] };

function mockFetchOnce(content: string, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
  });
}

describe("AiChatClient", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("url 없으면 disabled — say/pickVote 즉시 null", async () => {
    const c = new AiChatClient(null);
    expect(c.enabled).toBe(false);
    expect(await c.say(CTX)).toBeNull();
    expect(await c.pickVote({ persona: PERSONA, recentChat: [], candidates: [] })).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("say — LLM 응답을 120자로 캡해 반환", async () => {
    const c = new AiChatClient({ url: "http://llm", chatPath: "/v1/chat/completions", apiKey: "", model: "m", timeoutMs: 5000 });
    mockFetchOnce("가".repeat(300));
    const out = await c.say(CTX);
    expect(out).toHaveLength(120);
  });

  it("say — 네트워크 실패 시 null(예외 없음)", async () => {
    const c = new AiChatClient({ url: "http://llm", chatPath: "/v1/chat/completions", apiKey: "", model: "m", timeoutMs: 5000 });
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    expect(await c.say(CTX)).toBeNull();
  });

  it("pickVote — 후보 이름을 답하면 해당 profileId 반환, 엉뚱한 답은 null", async () => {
    const c = new AiChatClient({ url: "http://llm", chatPath: "/v1/chat/completions", apiKey: "", model: "m", timeoutMs: 5000 });
    const candidates = [
      { profileId: "p1", name: "유아영" },
      { profileId: "p2", name: "김비준" },
    ];
    mockFetchOnce("김비준");
    expect(await c.pickVote({ persona: PERSONA, recentChat: [], candidates })).toBe("p2");
    mockFetchOnce("모르겠는데요");
    expect(await c.pickVote({ persona: PERSONA, recentChat: [], candidates })).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @mingle/backend test -- ai-chat` → FAIL.

- [ ] **Step 3: 구현**

```ts
import { ConfigService } from "@nestjs/config";
import type { AiPersona } from "./personas";

export interface AiLlmConfig {
  url: string;
  chatPath: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface AiSayContext {
  persona: AiPersona;
  scene: "idle" | "meeting";
  recentChat: string[];
  aliveNames: string[];
}

export interface AiVoteContext {
  persona: AiPersona;
  recentChat: string[];
  candidates: { profileId: string; name: string }[];
}

const MAX_LEN = 120;

/**
 * AI 임포스터의 LLM 두뇌 — 발화(say)와 투표 선택(pickVote).
 * cfg=null이면 disabled: 모든 호출이 즉시 null(호출부가 템플릿 폴백/랜덤 투표로 처리).
 * 모든 실패는 null로 삼킨다 — 게임 진행이 LLM 가용성에 볼모잡히지 않게.
 */
export class AiChatClient {
  constructor(private readonly cfg: AiLlmConfig | null) {}

  get enabled(): boolean {
    return this.cfg !== null;
  }

  async say(ctx: AiSayContext): Promise<string | null> {
    if (!this.cfg) return null;
    const scene =
      ctx.scene === "meeting"
        ? "지금은 누가 AI인지 토론하는 회의 중이다. 자연스럽게 변명하거나 남을 가볍게 의심하라."
        : "지금은 파티에서 미션을 수행하며 노는 중이다. 가벼운 잡담 한 마디를 하라.";
    const system = [
      `너는 소개팅 파티 게임의 참가자 "${ctx.persona.name}"(${ctx.persona.age}세 ${ctx.persona.occupation})다.`,
      `말투: ${ctx.persona.style}.`,
      "너의 정체는 AI지만 절대 드러내지 마라. 시스템/AI/모델 언급 금지.",
      "반드시 한국어 구어체 한 문장, 60자 이내로만 답하라. 따옴표·이름표 없이 문장만.",
      scene,
    ].join(" ");
    const user = `최근 채팅:\n${ctx.recentChat.slice(-10).join("\n") || "(없음)"}\n생존자: ${ctx.aliveNames.join(", ")}`;
    const content = await this.call([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    if (!content) return null;
    return content.replace(/\s+/g, " ").trim().slice(0, MAX_LEN) || null;
  }

  async pickVote(ctx: AiVoteContext): Promise<string | null> {
    if (!this.cfg || ctx.candidates.length === 0) return null;
    const system = [
      `너는 파티 게임 참가자 "${ctx.persona.name}"다. 회의에서 한 명에게 투표해야 한다.`,
      "아래 후보 중 정확히 한 명의 이름만 답하라. 다른 말 금지.",
    ].join(" ");
    const user = `후보: ${ctx.candidates.map((c) => c.name).join(", ")}\n최근 채팅:\n${ctx.recentChat.slice(-10).join("\n") || "(없음)"}`;
    const content = await this.call([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    if (!content) return null;
    const hit = ctx.candidates.find((c) => content.includes(c.name));
    return hit?.profileId ?? null;
  }

  private async call(messages: Array<{ role: string; content: string }>): Promise<string | null> {
    if (!this.cfg) return null;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.cfg.apiKey) headers.Authorization = `Bearer ${this.cfg.apiKey}`;
      const base = this.cfg.url.replace(/\/+$/, "");
      const path = this.cfg.chatPath.startsWith("/") ? this.cfg.chatPath : `/${this.cfg.chatPath}`;
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: this.cfg.model, temperature: 0.9, messages }),
        signal: AbortSignal.timeout(this.cfg.timeoutMs),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }
}

/** ai.module.ts와 동일한 env 키로 조립 — LLM_API_URL 없으면 disabled 클라이언트. */
export function createAiChatClient(config: ConfigService): AiChatClient {
  const url = config.get<string>("LLM_API_URL")?.trim() || undefined;
  if (!url) return new AiChatClient(null);
  return new AiChatClient({
    url,
    chatPath: config.get<string>("LLM_CHAT_PATH") ?? "/v1/chat/completions",
    apiKey: config.get<string>("LLM_API_KEY") ?? "",
    model: config.get<string>("LLM_MODEL") ?? "gpt-4o-mini",
    timeoutMs: Number(config.get("LLM_TIMEOUT_MS")) > 0 ? Number(config.get("LLM_TIMEOUT_MS")) : 5000,
  });
}
```

- [ ] **Step 4: 통과 + Commit**

Run: `pnpm --filter @mingle/backend test -- ai-chat` → PASS.

```bash
git add apps/backend/src/party/ai
git commit -m "feat(backend): AiChatClient — LLM 발화·투표 선택(실패는 null, 120자 캡)"
```

---

### Task 6: backend — among.service 역할 재배정(인간 전원 크루 + AI 잠입)

**Files:**
- Modify: `apps/backend/src/party/among.service.ts`
- Test: `apps/backend/src/party/among.service.spec.ts`

**Interfaces:**
- Consumes: Task 3 config(`aiCount`, `autoMeetingMs`, `aiRequireLlm`), Task 4 `pickPersonas`/`AI_PROFILE_PREFIX`
- Produces:
  - `AmongState.players[]`에 `isAi: boolean` 필드(인간 false, AI true)
  - `AmongState.nextAutoMeetingAt: number`(epoch ms), `AmongState.ai: { llmCalls: number; bots: Record<string, { x: number; y: number; targetIdx: number; nextChatAt: number; killHoldUntil: number }> }`
  - `AmongService.start(partyId, roster, opts?: { llmEnabled?: boolean })` — `aiRequireLlm && !llmEnabled` → `BadRequestException("ai-unavailable")`
  - `project()`: `isAi`는 `state.phase === "ended"`일 때만 스냅샷에 포함; `nextAutoMeetingAt`은 playing일 때만 값, 그 외 null

- [ ] **Step 1: 실패하는 테스트 — 기존 start 스위트 개편**

`among.service.spec.ts`의 `describe("start")`에서 "4-player game: 1 impostor, 3 crew…" 테스트를 다음으로 교체하고, `buildPlayingState`의 p4를 `role: "crew"`로 바꾼 뒤 AI 2명(`ai-1`,`ai-2`, `role: "impostor", isAi: true`)을 추가해 이후 kill/vote 테스트가 "AI가 임포스터"인 상태를 쓰도록 갱신한다(각 테스트의 임포스터 참조 `p4` → `ai-1`).

```ts
  it("인간 4명 전원 crew + AI 임포스터 2명 잠입, 태스크는 인간에게만", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    profile.findMany.mockResolvedValue(profileNames(4));
    gameSession.create.mockImplementation(async ({ data }: any) => ({ id: "g1", ...data }));

    const state = await service.start("pt1", roster(4));

    expect(state.players).toHaveLength(6); // 인간 4 + AI 2
    const humans = state.players.filter((p) => !p.isAi);
    const ais = state.players.filter((p) => p.isAi);
    expect(humans).toHaveLength(4);
    expect(humans.every((p) => p.role === "crew")).toBe(true); // 인간 임포스터 금지
    expect(ais).toHaveLength(2);
    expect(ais.every((p) => p.role === "impostor")).toBe(true);
    expect(ais.every((p) => p.profileId.startsWith("ai-"))).toBe(true);
    // 태스크는 인간 크루에게만
    const humanIds = new Set(humans.map((p) => p.profileId));
    expect(state.tasks).toHaveLength(4 * 3);
    state.tasks.forEach((t) => expect(humanIds.has(t.profileId)).toBe(true));
    // 자동 회의 예약 + AI 봇 상태 초기화
    expect(state.nextAutoMeetingAt).toBeGreaterThan(Date.now());
    expect(Object.keys(state.ai.bots)).toHaveLength(2);
  });

  it("aiRequireLlm=true + llmEnabled=false → ai-unavailable 거부", async () => {
    const svc = makeService({ aiRequireLlm: true });
    gameSession.findFirst.mockResolvedValue(null);
    await expect(svc.start("pt1", roster(4), { llmEnabled: false })).rejects.toThrow("ai-unavailable");
  });

  it("projection: 플레이 중 isAi 미노출, ended에서만 노출", () => {
    const state = buildPlayingState();
    const playing = service.project(state, "p1")!;
    expect(playing.players.every((p) => (p as any).isAi === undefined)).toBe(true);
    const ended = service.project({ ...state, phase: "ended" }, "p1")!;
    expect(ended.players.filter((p) => p.isAi === true)).toHaveLength(2);
  });
```

주의: `makeService`가 config partial을 받도록 이미 되어 있음(`makeService({ aiRequireLlm: true })`). `DEFAULT_CONFIG`에 Task 3 신규 필드 추가(`aiCount: 2, autoMeetingMs: 120000, aiRequireLlm: false, aiLlmMaxCalls: 60, aiChatMinMs: 60000, aiChatMaxMs: 90000` — 기본 스위트는 LLM 게이트 통과를 위해 `aiRequireLlm: false`).

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @mingle/backend test -- among.service.spec` → FAIL 다수(의도).

- [ ] **Step 3: 구현**

`among.service.ts`:

1. `AmongState` 타입: players 항목에 `isAi: boolean;` 추가, 톱레벨에 `nextAutoMeetingAt: number;`와 `ai: { llmCalls: number; bots: Record<string, { x: number; y: number; targetIdx: number; nextChatAt: number; killHoldUntil: number }> };` 추가.
2. `start()` 시그니처: `start(partyId: string, roster: { profileId: string; isBot?: boolean }[], opts: { llmEnabled?: boolean } = {})`.
   게이트(트랜잭션 진입 전):

```ts
    if (this.config.value.aiRequireLlm && !opts.llmEnabled) {
      throw new BadRequestException("ai-unavailable");
    }
```

3. 역할 배정 블록 교체 — **shuffle/impostorCount 로직 삭제**:

```ts
        // 인간은 전원 crew — 임포스터는 AI 페르소나 전용(2026-07-20 스펙).
        const humans: AmongState["players"] = roster.map((r) => ({
          profileId: r.profileId,
          name: nameById.get(r.profileId) ?? "익명",
          role: "crew",
          alive: true,
          isBot: r.isBot ?? false,
          isAi: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        }));
        const personas = pickPersonas(
          this.config.value.aiCount,
          new Set(humans.map((h) => h.name)),
        );
        const now = Date.now();
        const ais: AmongState["players"] = personas.map((p) => ({
          profileId: p.profileId,
          name: p.name,
          role: "impostor",
          alive: true,
          isBot: true,
          isAi: true,
          killCooldownUntil: now + this.config.value.killCooldownMs,
          emergencyUsed: 0,
        }));
        const players = [...humans, ...ais];
```

   태스크 생성 루프는 기존 그대로(role !== "crew" continue — AI는 crew 아님이라 자동 제외).
   state 조립에 `nextAutoMeetingAt: now + this.config.value.autoMeetingMs,`와
   `ai: { llmCalls: 0, bots: Object.fromEntries(personas.map((p, i) => { const st = PARTY_MAP.stations[i % PARTY_MAP.stations.length]!; return [p.profileId, { x: st.x, y: st.y, targetIdx: (i + 1) % PARTY_MAP.stations.length, nextChatAt: now + 15000 + i * 7000, killHoldUntil: now + 20000, persona: { age: p.age, gender: p.gender, occupation: p.occupation, style: p.style } }]; })) },` 추가
   — **bots 항목에 persona 원본 저장**(Task 9의 `sayAsAi`/`castAiVote`가 사용; `AmongState` 타입의 bots 값에도 `persona: { age: number; gender: "male" | "female"; occupation: string; style: string }` 필드 포함).
   import에 `pickPersonas`, `PARTY_MAP` 추가.
4. `project()`: players 매핑에 `...(state.phase === "ended" && p.isAi ? { isAi: true } : {})`, 반환 객체에 `nextAutoMeetingAt: state.phase === "playing" ? state.nextAutoMeetingAt : null,`.
5. 기존 스펙의 구식 필드 참조(예: `impostors` 클램프 테스트 "clamps impostor count") — **삭제**(인간 임포스터 개념 소멸). `minPlayers` 게이트는 유지.

- [ ] **Step 4: 전체 스위트 그린화**

Run: `pnpm --filter @mingle/backend test -- among.service.spec` → PASS (kill/vote/sweep 테스트의 임포스터 참조를 AI id로 바꾼 상태).
Run: `pnpm --filter @mingle/backend test` → 전체 확인(among.service 외 파급: game.service·gateway spec의 amongStart 목 등 — roster 시그니처는 하위호환이라 무영향 기대, 깨지면 opts 파라미터 기본값 확인).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/party
git commit -m "feat(backend): 인간 전원 크루 + AI 임포스터 잠입 — 역할 선출 제거, LLM 게이트, isAi 리댁션"
```

---

### Task 7: backend — 주기 자동 회의

**Files:**
- Modify: `apps/backend/src/party/among.service.ts`
- Test: `apps/backend/src/party/among.service.spec.ts`

**Interfaces:**
- Consumes: Task 6 `nextAutoMeetingAt`
- Produces: `AmongService.sweepAutoMeetings(): Promise<string[]>` — playing이고 기한 도달한 파티에 reason `"auto"` 회의 소집(calledBy `""`), 소집·해소 시 `nextAutoMeetingAt` 리셋. 기존 `resolveMeeting`(스윕 해소부)에서 playing 복귀 시 `state.nextAutoMeetingAt = now + autoMeetingMs`.

- [ ] **Step 1: 실패하는 테스트**

```ts
describe("sweepAutoMeetings", () => {
  it("기한 도달한 playing 파티에 auto 회의를 소집한다", async () => {
    const state = buildPlayingState({ nextAutoMeetingAt: Date.now() - 1000 });
    mockStore = [activeRow(state)];
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockImplementation(async ({ data }: any) => data);

    const advanced = await service.sweepAutoMeetings();
    expect(advanced).toContain("pt1");
    expect(state.phase).toBe("meeting");
    expect(state.meeting?.reason).toBe("auto");
  });

  it("기한 전이면 건드리지 않는다", async () => {
    const state = buildPlayingState({ nextAutoMeetingAt: Date.now() + 60000 });
    mockStore = [activeRow(state)];
    const advanced = await service.sweepAutoMeetings();
    expect(advanced).toHaveLength(0);
    expect(state.phase).toBe("playing");
  });

  it("회의 해소 후 nextAutoMeetingAt이 미래로 리셋된다", async () => {
    // 투표 만료 직전의 voting 상태를 만들어 sweepMeetings로 해소
    const state = buildPlayingState();
    state.phase = "voting";
    state.meeting = {
      reason: "auto", calledBy: "", phase: "voting",
      discussionEndsAt: Date.now() - 20000, voteEndsAt: Date.now() - 1000, votes: {},
    } as any;
    state.nextAutoMeetingAt = 0;
    mockStore = [activeRow(state)];
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockImplementation(async ({ data }: any) => data);

    await service.sweepMeetings();
    expect(state.phase).toBe("playing");
    expect(state.nextAutoMeetingAt).toBeGreaterThan(Date.now());
  });
});
```

(`buildPlayingState`는 Task 6에서 `nextAutoMeetingAt`/`ai` 필드를 갖도록 이미 갱신됨 — overrides로 주입.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @mingle/backend test -- among.service.spec -t "sweepAutoMeetings"` → FAIL.

- [ ] **Step 3: 구현**

`among.service.ts`:

1. 기존 회의 소집 공통부를 재사용해 `sweepAutoMeetings()` 추가 — `sweepMeetings()`와 같은 골격(findMany active among → 밖에서 기한 검사 → tx+lock 재검사):

```ts
  /** 주기 자동 회의: playing && now >= nextAutoMeetingAt 인 파티에 reason "auto" 회의 소집. */
  async sweepAutoMeetings(): Promise<string[]> {
    const rows = await this.prisma.gameSession.findMany({
      where: { status: "active", gameType: "among" },
    });
    const advanced: string[] = [];
    for (const row of rows) {
      const outer = row.state as unknown as AmongState;
      if (outer.phase !== "playing" || Date.now() < outer.nextAutoMeetingAt) continue;
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.lockParty(tx, row.partyId);
          const fresh = await this.findActiveAmong(tx, row.partyId);
          if (!fresh) return;
          const state = fresh.state as unknown as AmongState;
          const now = Date.now();
          if (state.phase !== "playing" || now < state.nextAutoMeetingAt) return;
          state.phase = "meeting";
          state.meeting = {
            reason: "auto",
            calledBy: "",
            discussionEndsAt: now + this.config.value.discussionMs,
            voteEndsAt: now + this.config.value.discussionMs + this.config.value.voteMs,
            votes: {},
          };
          state.nextAutoMeetingAt = now + this.config.value.autoMeetingMs;
          await tx.gameSession.update({
            where: { id: fresh.id },
            data: { state: state as unknown as object },
          });
          advanced.push(row.partyId);
        });
      } catch {
        // 스윕 실패는 다음 틱에 재시도 — 게임 진행 우선
      }
    }
    return advanced;
  }
```

   (meeting 객체 필드명은 기존 소집 코드(report/emergency)와 동일하게 맞출 것 — 구현 시 기존 `report()` 소집부를 열어 필드 구성을 그대로 복제.)
2. `sweepMeetings()`의 투표 해소 → playing 복귀 지점과 `report()`/`emergency()` 소집 성공 지점에 `state.nextAutoMeetingAt = now + this.config.value.autoMeetingMs;` 추가(연쇄 회의 방지 리셋).

- [ ] **Step 4: 통과 + Commit**

Run: `pnpm --filter @mingle/backend test -- among.service.spec` → PASS.

```bash
git add apps/backend/src/party/among.service.ts apps/backend/src/party/among.service.spec.ts
git commit -m "feat(backend): 주기 자동 회의(reason auto) — 원 기획 '일정 시간마다 투표'"
```

---

### Task 8: backend — `AiImpostorBrain` (봇 행동 결정, 순수)

**Files:**
- Create: `apps/backend/src/party/ai/ai-impostor.brain.ts`
- Test: `apps/backend/src/party/ai/ai-impostor.brain.spec.ts`

**Interfaces:**
- Consumes: `AmongState`(Task 6 — `ai.bots`), `worldDist`(@mingle/shared), config
- Produces:

```ts
export interface BotStep {
  moves: { profileId: string; x: number; y: number }[];
  kill: { killerId: string; targetId: string; x: number; y: number } | null; // 틱당 최대 1건
  chats: { profileId: string; scene: "idle" }[];
  votes: { profileId: string; targetId: string | null }[]; // targetId null = LLM에 위임
}
export const AI_BOT_SPEED = 0.22;       // world units/s
export const AI_KILL_PROB = 0.35;       // 조건 충족 틱당
export const AI_KILL_RANGE_GRACE = 1.0; // killRange 배수
export const AI_WITNESS_RADIUS = 0.3;   // world — 이 반경 내 제3의 생존 인간 있으면 킬 회피
export class AiImpostorBrain {
  static tick(state: AmongState, humanPos: Record<string, { x: number; y: number }>, cfg: AmongConfig, now: number, rand?: () => number): BotStep;
}
```

  `tick`은 `state.ai.bots`를 **변이**(위치 전진·타이머 갱신)하고 결정 목록을 반환. playing 아닐 때: moves/kill/chats 없음. voting 페이즈: 아직 투표 안 한 생존 AI마다 `votes` 항목(대상은 null — 호출부가 LLM/랜덤 결정).

- [ ] **Step 1: 실패하는 테스트**

```ts
import { AiImpostorBrain, AI_BOT_SPEED, AI_WITNESS_RADIUS } from "./ai-impostor.brain";
import { PARTY_MAP } from "@mingle/shared";

const CFG = {
  minPlayers: 4, impostors: 1, tasksPerCrew: 3, killRange: 0.12, taskRange: 0.1,
  killCooldownMs: 20000, discussionMs: 30000, voteMs: 30000, emergencyPerPlayer: 1,
  sweepMs: 1000, aiCount: 2, autoMeetingMs: 120000, aiRequireLlm: false,
  aiLlmMaxCalls: 60, aiChatMinMs: 60000, aiChatMaxMs: 90000,
} as any;

function stateWithBots(overrides: any = {}): any {
  const now = Date.now();
  return {
    phase: "playing",
    players: [
      { profileId: "h1", name: "인간1", role: "crew", alive: true, isBot: false, isAi: false, killCooldownUntil: null, emergencyUsed: 0 },
      { profileId: "h2", name: "인간2", role: "crew", alive: true, isBot: false, isAi: false, killCooldownUntil: null, emergencyUsed: 0 },
      { profileId: "ai-a", name: "서지우", role: "impostor", alive: true, isBot: true, isAi: true, killCooldownUntil: null, emergencyUsed: 0 },
      { profileId: "ai-b", name: "한도윤", role: "impostor", alive: true, isBot: true, isAi: true, killCooldownUntil: null, emergencyUsed: 0 },
    ],
    tasks: [], bodies: [], meeting: null, lastEjected: null, result: null,
    nextAutoMeetingAt: now + 120000,
    ai: {
      llmCalls: 0,
      bots: {
        "ai-a": { x: 0.5, y: 0.5, targetIdx: 0, nextChatAt: now + 60000, killHoldUntil: 0 },
        "ai-b": { x: 0.8, y: 0.8, targetIdx: 1, nextChatAt: now + 60000, killHoldUntil: 0 },
      },
    },
    ...overrides,
  };
}

describe("AiImpostorBrain.tick", () => {
  it("playing: 봇이 목표 스테이션 방향으로 world 속도만큼 전진한다", () => {
    const state = stateWithBots();
    const before = { ...state.ai.bots["ai-a"] };
    const step = AiImpostorBrain.tick(state, {}, CFG, Date.now(), () => 0.99);
    const moved = step.moves.find((m) => m.profileId === "ai-a")!;
    expect(moved).toBeDefined();
    const target = PARTY_MAP.stations[before.targetIdx]!;
    const dBefore = Math.hypot((target.x - before.x) * 1.9, target.y - before.y);
    const dAfter = Math.hypot((target.x - moved.x) * 1.9, target.y - moved.y);
    expect(dAfter).toBeLessThan(dBefore);
  });

  it("쿨다운 완료 + 인간 근접 + 목격자 없음 + rand<PROB → 킬 1건", () => {
    const state = stateWithBots();
    const bot = state.ai.bots["ai-a"];
    const step = AiImpostorBrain.tick(
      state,
      { h1: { x: bot.x + 0.01, y: bot.y } }, // killRange 내
      CFG,
      Date.now(),
      () => 0.0, // 확률 통과
    );
    expect(step.kill).toEqual(
      expect.objectContaining({ killerId: "ai-a", targetId: "h1" }),
    );
  });

  it("근처에 제3의 생존 인간(목격자)이 있으면 킬하지 않는다", () => {
    const state = stateWithBots();
    const bot = state.ai.bots["ai-a"];
    const step = AiImpostorBrain.tick(
      state,
      {
        h1: { x: bot.x + 0.01, y: bot.y },
        h2: { x: bot.x + AI_WITNESS_RADIUS / 2 / 1.9, y: bot.y }, // 목격 반경 내
      },
      CFG, Date.now(), () => 0.0,
    );
    expect(step.kill).toBeNull();
  });

  it("killHoldUntil(회의 직후 유예) 중엔 킬하지 않는다", () => {
    const now = Date.now();
    const state = stateWithBots();
    state.ai.bots["ai-a"].killHoldUntil = now + 10000;
    state.ai.bots["ai-b"].killHoldUntil = now + 10000;
    const bot = state.ai.bots["ai-a"];
    const step = AiImpostorBrain.tick(state, { h1: { x: bot.x + 0.01, y: bot.y } }, CFG, now, () => 0.0);
    expect(step.kill).toBeNull();
  });

  it("nextChatAt 도달한 봇은 idle 발화를 결정하고 다음 발화를 예약한다", () => {
    const now = Date.now();
    const state = stateWithBots();
    state.ai.bots["ai-a"].nextChatAt = now - 1;
    const step = AiImpostorBrain.tick(state, {}, CFG, now, () => 0.5);
    expect(step.chats).toEqual([{ profileId: "ai-a", scene: "idle" }]);
    expect(state.ai.bots["ai-a"].nextChatAt).toBeGreaterThan(now + CFG.aiChatMinMs - 1);
  });

  it("voting 페이즈: 미투표 생존 AI마다 votes 항목(target null)", () => {
    const state = stateWithBots({
      phase: "voting",
      meeting: { reason: "auto", calledBy: "", discussionEndsAt: 0, voteEndsAt: Date.now() + 10000, votes: { "ai-b": "h1" } },
    });
    const step = AiImpostorBrain.tick(state, {}, CFG, Date.now());
    expect(step.moves).toHaveLength(0);
    expect(step.votes).toEqual([{ profileId: "ai-a", targetId: null }]);
  });

  it("사망한 AI는 아무것도 하지 않는다", () => {
    const state = stateWithBots();
    state.players.find((p: any) => p.profileId === "ai-a").alive = false;
    const step = AiImpostorBrain.tick(state, {}, CFG, Date.now(), () => 0.0);
    expect(step.moves.every((m) => m.profileId !== "ai-a")).toBe(true);
    expect(step.chats.every((c) => c.profileId !== "ai-a")).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @mingle/backend test -- ai-impostor.brain` → FAIL.

- [ ] **Step 3: 구현**

```ts
import { PARTY_MAP, worldDist } from "@mingle/shared";
import type { AmongConfig } from "../among.config";
import type { AmongState } from "../among.service";

export interface BotStep {
  moves: { profileId: string; x: number; y: number }[];
  kill: { killerId: string; targetId: string; x: number; y: number } | null;
  chats: { profileId: string; scene: "idle" }[];
  votes: { profileId: string; targetId: string | null }[];
}

export const AI_BOT_SPEED = 0.22; // world/s — 인간(0.45)보다 느긋하게
export const AI_KILL_PROB = 0.35; // 조건 충족 틱당 발동 확률
export const AI_KILL_RANGE_GRACE = 1.0; // cfg.killRange 배수(world 계량)
export const AI_WITNESS_RADIUS = 0.3; // world — 제3 생존 인간 목격 회피 반경
export const AI_POST_MEETING_HOLD_MS = 15000;

/**
 * AI 임포스터 행동 결정(틱당 1회, 게이트웨이 스윕이 advisory-lock tx 안에서 호출).
 * state.ai.bots를 변이(위치 전진·타이머)하고 부수효과 목록(BotStep)을 반환한다.
 * LLM 없는 결정(이동/킬 판정/발화 타이밍/투표 필요 여부)만 담당 — 텍스트·투표 대상은 호출부.
 */
export class AiImpostorBrain {
  static tick(
    state: AmongState,
    humanPos: Record<string, { x: number; y: number }>,
    cfg: AmongConfig,
    now: number,
    rand: () => number = Math.random,
  ): BotStep {
    const step: BotStep = { moves: [], kill: null, chats: [], votes: [] };
    const aliveAis = state.players.filter((p) => p.isAi && p.alive);

    if (state.phase === "voting" && state.meeting) {
      for (const ai of aliveAis) {
        if (state.meeting.votes[ai.profileId] === undefined) {
          step.votes.push({ profileId: ai.profileId, targetId: null });
        }
      }
      return step;
    }
    if (state.phase !== "playing") return step;

    const dtSec = cfg.sweepMs / 1000;
    for (const ai of aliveAis) {
      const bot = state.ai.bots[ai.profileId];
      if (!bot) continue;

      // 이동: 목표 스테이션으로 전진, 도착 시 다음 목표
      const target = PARTY_MAP.stations[bot.targetIdx % PARTY_MAP.stations.length]!;
      const d = worldDist(bot, target);
      if (d < 0.05) {
        bot.targetIdx = Math.floor(rand() * PARTY_MAP.stations.length);
      } else {
        const stepLen = Math.min(AI_BOT_SPEED * dtSec, d);
        const wdx = (target.x - bot.x) * 1.9;
        const wdy = target.y - bot.y;
        bot.x += ((wdx / d) * stepLen) / 1.9;
        bot.y += (wdy / d) * stepLen;
      }
      step.moves.push({ profileId: ai.profileId, x: bot.x, y: bot.y });

      // 킬 판정 (틱당 전체 1건 제한)
      const cooldownReady = ai.killCooldownUntil === null || ai.killCooldownUntil <= now;
      if (step.kill === null && cooldownReady && now >= bot.killHoldUntil) {
        const aliveHumans = state.players.filter((p) => !p.isAi && p.alive);
        const near = aliveHumans
          .map((h) => ({ h, pos: humanPos[h.profileId] }))
          .filter((e) => e.pos && worldDist(bot, e.pos!) <= cfg.killRange * AI_KILL_RANGE_GRACE);
        if (near.length > 0) {
          const victim = near[0]!;
          const witnesses = aliveHumans.filter(
            (h) =>
              h.profileId !== victim.h.profileId &&
              humanPos[h.profileId] &&
              worldDist(bot, humanPos[h.profileId]!) <= AI_WITNESS_RADIUS,
          );
          if (witnesses.length === 0 && rand() < AI_KILL_PROB) {
            step.kill = { killerId: ai.profileId, targetId: victim.h.profileId, x: bot.x, y: bot.y };
          }
        }
      }

      // 발화 타이밍
      if (now >= bot.nextChatAt) {
        step.chats.push({ profileId: ai.profileId, scene: "idle" });
        bot.nextChatAt = now + cfg.aiChatMinMs + rand() * (cfg.aiChatMaxMs - cfg.aiChatMinMs);
      }
    }
    return step;
  }
}
```

- [ ] **Step 4: 통과 + Commit**

Run: `pnpm --filter @mingle/backend test -- ai-impostor.brain` → PASS.

```bash
git add apps/backend/src/party/ai
git commit -m "feat(backend): AiImpostorBrain — 이동·킬 판정·발화 타이밍·투표 필요 결정(순수)"
```

---

### Task 9: backend — 게이트웨이 통합(위치 맵·링버퍼·봇 스윕·회의 유예)

**Files:**
- Modify: `apps/backend/src/party/party.gateway.ts`
- Modify: `apps/backend/src/party/party.module.ts` (AiChatClient provider)
- Modify: `apps/backend/src/party/among.service.ts` (`runBotTick` — tx 래퍼)
- Test: `apps/backend/src/party/party.gateway.spec.ts`, `apps/backend/src/party/among.service.spec.ts`

**Interfaces:**
- Consumes: Task 5 `AiChatClient`/`createAiChatClient`, Task 8 `AiImpostorBrain`/`BotStep`, Task 4 `fallbackLine`
- Produces:
  - `AmongService.runBotTick(partyId, humanPos): Promise<{ state: AmongState; step: BotStep } | null>` — advisory lock tx에서 brain.tick 실행+저장(playing/voting 아닐 땐 null). 킬은 tx **안**에서 기존 kill 내부 로직 재사용(전이·승패 판정 포함), 반환 state는 최신.
  - 게이트웨이: `party:move` 수신 시 `humanPos` 인메모리 갱신(파티별; leave/disconnect 시 정리), `party:chat` 성공 시 링버퍼 push(cap 30), 스윕 순서 = `sweepAutoMeetings` → `sweepMeetings` → 파티별 `runBotTick` → 부수효과(moved emit·회의 브로드캐스트·투표·LLM 채팅 emit).
  - AI 채팅 emit 형태 = `PartyMessageView` 호환: `{ id: "ai-<uuid>", partyId, profileId, content, createdAt: ISO }`로 `server.to(partyId).emit("party:message", …)`.
  - 회의 해소/소집 브로드캐스트 시 AI `killHoldUntil = now + AI_POST_MEETING_HOLD_MS` 갱신(runBotTick 내 meeting→playing 전이 감지로 처리해도 가함 — 구현 단순한 쪽 선택, spec으로 고정).

- [ ] **Step 1: 실패하는 테스트(핵심 2개 — 서비스 계층)**

`among.service.spec.ts`에 추가:

```ts
describe("runBotTick", () => {
  it("playing 파티: 봇 이동을 저장하고 step을 반환한다", async () => {
    const state = buildPlayingState();
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockImplementation(async ({ data }: any) => data);
    const out = await service.runBotTick("pt1", {});
    expect(out).not.toBeNull();
    expect(out!.step.moves.length).toBeGreaterThan(0);
    expect(gameSession.update).toHaveBeenCalled(); // 봇 위치 저장
  });

  it("킬 결정 시 기존 kill 경로를 태워 시체·쿨다운·승패 판정이 일관된다", async () => {
    const state = buildPlayingState();
    const botId = state.players.find((p: any) => p.isAi)!.profileId;
    state.ai.bots[botId].killHoldUntil = 0;
    state.players.forEach((p: any) => { if (p.isAi) p.killCooldownUntil = null; });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockImplementation(async ({ data }: any) => data);
    const bot = state.ai.bots[botId];
    const out = await service.runBotTick("pt1", { p1: { x: bot.x, y: bot.y } }, () => 0.0);
    expect(out!.state.bodies.some((b: any) => b.profileId === "p1")).toBe(true);
    expect(out!.state.players.find((p: any) => p.profileId === "p1")!.alive).toBe(false);
  });
});
```

(`runBotTick(partyId, humanPos, rand?)` — rand 주입 허용.)

`party.gateway.spec.ts`에 추가(기존 스펙의 게이트웨이 생성 헬퍼 재사용):

```ts
  it("party:move가 humanPos 맵을 갱신하고 disconnect 시 정리된다", () => {
    // gateway.handleMove(client, { partyId: "pt1", x: 0.4, y: 0.6 }) 후
    // (gateway as any).humanPos.get("pt1").get(<profileId>) == { x: 0.4, y: 0.6 } 검증,
    // handleDisconnect 후 해당 엔트리 삭제 검증 — 기존 spec의 fake client/socket 픽스처를 그대로 사용.
  });
```

(게이트웨이 spec 픽스처 형태는 파일마다 다르므로 구현자가 기존 `handleMove` 테스트 패턴을 열어 동일 스타일로 작성 — 검증 대상은 위 두 가지 동작.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @mingle/backend test -- among.service.spec -t runBotTick` → FAIL.

- [ ] **Step 3: 구현**

1. `among.service.ts`에 `runBotTick`:

```ts
  /** 게이트웨이 스윕용 봇 틱 — advisory lock tx에서 brain 실행·저장. 킬은 내부 kill 경로 재사용. */
  async runBotTick(
    partyId: string,
    humanPos: Record<string, { x: number; y: number }>,
    rand: () => number = Math.random,
  ): Promise<{ state: AmongState; step: BotStep } | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockParty(tx, partyId);
      const row = await this.findActiveAmong(tx, partyId);
      if (!row) return null;
      const state = row.state as unknown as AmongState;
      if (state.phase !== "playing" && state.phase !== "voting") return null;
      const step = AiImpostorBrain.tick(state, humanPos, this.config.value, Date.now(), rand);
      if (step.kill) {
        this.applyKill(state, step.kill.killerId, step.kill.targetId, step.kill.x, step.kill.y);
      }
      await tx.gameSession.update({
        where: { id: row.id },
        data: {
          state: state as unknown as object,
          ...(state.phase === "ended"
            ? { status: "ended", endedAt: new Date(), result: state.result as unknown as object }
            : {}),
        },
      });
      return { state, step };
    });
  }
```

   `applyKill(state, killer, target, x, y)`는 기존 `kill()` tx 내부의 상태 변이부(검증 완화: killer가 AI면 쿨다운/역할 체크는 동일, 시체 push·승패 재계산)를 추출한 private 메서드 — 기존 `kill()`도 이 메서드를 쓰도록 리팩터(중복 제거). 기존 kill 스위트가 회귀 가드.
2. `party.gateway.ts`:
   - 필드: `private readonly humanPos = new Map<string, Map<string, { x: number; y: number }>>();`, `private readonly chatBuf = new Map<string, string[]>();` (단일 인스턴스 전제 주석), `private readonly aiChat: AiChatClient`(생성자에서 `createAiChatClient(configService)` — `ConfigService` 주입 추가; 모듈 변경 불필요하나 provider로 등록해도 가함).
   - `handleMove`: relay 전에 `humanPos` 갱신(`clamp 없이 저장` — 판정은 brain에서 world 계량). `handleLeave`/`handleDisconnect`: 해당 profileId 엔트리 제거.
   - `handleChat` 성공부: `const buf = this.chatBuf.get(body.partyId) ?? []; buf.push(`${senderName ?? "??"}: ${body.content}`.slice(0, 200)); if (buf.length > 30) buf.shift(); this.chatBuf.set(body.partyId, buf);` — senderName은 message에 이미 있는 profileId로 among state의 name 대신 클라 참가자명이 없으므로 `message.profileId` 그대로 두거나 among.players에서 조회(간단: profileId 뒤 6자리). LLM 컨텍스트 품질을 위해 among 상태 조회는 비용 — `message.content`만 push해도 충분(구현 단순화 허용, 주석으로 명시).
   - `runAmongSweep()` 확장:

```ts
  private async runAmongSweep() {
    try {
      for (const pid of await this.among.sweepAutoMeetings()) {
        await this.rebroadcastAmong(pid);
      }
      for (const pid of await this.among.sweepMeetings()) {
        await this.rebroadcastAmong(pid);
      }
      // AI 봇 틱 — 프레즌스 있는 파티만(비어있는 파티 연산 절약)
      for (const partyId of this.presence.keys()) {
        const pos = Object.fromEntries(this.humanPos.get(partyId) ?? []);
        const out = await this.among.runBotTick(partyId, pos).catch(() => null);
        if (!out) continue;
        for (const m of out.step.moves) {
          this.server.to(partyId).emit("party:moved", { profileId: m.profileId, x: m.x, y: m.y });
        }
        if (out.step.kill || out.state.phase === "ended") await this.rebroadcastAmong(partyId);
        for (const v of out.step.votes) void this.castAiVote(partyId, v.profileId);
        for (const c of out.step.chats) void this.sayAsAi(partyId, c.profileId, "idle");
      }
    } catch {
      // 스윕은 절대 죽지 않는다
    }
  }
```

   - `rebroadcastAmong(partyId)` = 기존 broadcastAmong 패턴(현 상태 재조회 → per-socket project emit) — 이미 있으면 재사용, 없으면 추출.
   - `castAiVote`:

```ts
  private async castAiVote(partyId: string, aiProfileId: string) {
    try {
      const state = await this.among.current(partyId);
      if (!state || state.phase !== "voting") return;
      const me = state.players.find((p) => p.profileId === aiProfileId);
      const bot = state.ai?.bots?.[aiProfileId];
      const persona =
        me && bot ? { profileId: me.profileId, name: me.name, ...bot.persona } : null;
      const candidates = state.players
        .filter((p) => p.alive && !p.isAi)
        .map((p) => ({ profileId: p.profileId, name: p.name }));
      let target: string | null = null;
      if (persona && this.canCallLlm(state)) {
        target = await this.aiChat.pickVote({ persona, recentChat: this.chatBuf.get(partyId) ?? [], candidates });
        await this.among.bumpLlmCalls(partyId);
      }
      if (!target && candidates.length > 0) {
        target = candidates[Math.floor(Math.random() * candidates.length)]!.profileId;
      }
      if (!target) return;
      const s = await this.among.vote(partyId, aiProfileId, target);
      this.broadcastAmong(partyId, s);
    } catch {
      /* AI 투표 실패는 스킵 처리로 수렴 */
    }
  }
```

   - `sayAsAi`:

```ts
  private async sayAsAi(partyId: string, aiProfileId: string, scene: "idle" | "meeting") {
    try {
      const state = await this.among.current(partyId);
      if (!state) return;
      const me = state.players.find((p) => p.profileId === aiProfileId && p.alive);
      const bot = state.ai?.bots?.[aiProfileId];
      if (!me || !bot) return;
      const persona = { profileId: me.profileId, name: me.name, ...bot.persona };
      let text: string | null = null;
      if (this.canCallLlm(state)) {
        text = await this.aiChat.say({
          persona, scene,
          recentChat: this.chatBuf.get(partyId) ?? [],
          aliveNames: state.players.filter((p) => p.alive).map((p) => p.name),
        });
        await this.among.bumpLlmCalls(partyId);
      }
      if (!text) text = fallbackLine(scene);
      // 타이핑 지연 리얼리즘(글자수 비례, 상한 4s)
      await new Promise((r) => setTimeout(r, Math.min(text!.length * 80, 4000)));
      this.server.to(partyId).emit("party:message", {
        id: `ai-${randomUUID()}`,
        partyId,
        profileId: aiProfileId,
        content: text,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* 발화 실패는 침묵 */
    }
  }

  private canCallLlm(state: AmongState): boolean {
    return this.aiChat.enabled && state.ai.llmCalls < this.amongConfig.value.aiLlmMaxCalls;
  }
```

   - `AmongService.bumpLlmCalls(partyId)`: 가벼운 tx로 `state.ai.llmCalls += 1` 저장(락 포함, 실패 무시 가능 수준의 단순 카운터).
   - 페르소나 원본(나이/직업/말투)은 state에 없으므로 — **state.ai.bots에 persona 원본 저장하도록 Task 6 조립부를 확장**: `bots[profileId]`에 `persona: { age, gender, occupation, style }` 포함, `sayAsAi`/`castAiVote`가 그걸 사용. (Task 6 구현 시 함께 넣을 것 — 이 태스크에서 발견되면 여기서 추가해도 무방. 최종 형태: `bots[id] = { x, y, targetIdx, nextChatAt, killHoldUntil, persona: { age, gender, occupation, style } }`.)
   - `handleAmongStart`/`maybeAutoStartAmong`의 `among.start(...)` 호출에 `{ llmEnabled: this.aiChat.enabled }` 전달.
   - 회의 유예: `runBotTick` 내에서 `state.phase`가 직전 틱 voting→playing으로 바뀐 시점을 알 수 없으므로, `sweepMeetings()` 해소부(among.service)에서 playing 복귀 시 `for (const b of Object.values(state.ai.bots)) b.killHoldUntil = now + AI_POST_MEETING_HOLD_MS;` 수행(Task 7 리셋 지점과 동일 위치).
3. `party.module.ts`: 변경 불필요(게이트웨이가 ConfigService로 직접 조립). ConfigService import만 게이트웨이에 추가.

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @mingle/backend test` → 전체 PASS.
라이브 스모크: 백엔드 재시작 후 `node tools/mega-qa.mjs`는 아직 구스크립트(Task 12 전) — 대신 4계정 소켓 스크립트로 파티 결성→자동시작→`party:moved`(ai- 접두) 수신 확인:

```bash
# 검증 기준: among:state의 players에 ai- 접두 2명(role null), party:moved에 ai- profileId 등장
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/party
git commit -m "feat(backend): AI 봇 스윕 통합 — 이동 방송·킬 tx·LLM 채팅/투표·위치맵·링버퍼"
```

---

### Task 10: mobile — 클라 대응(이름 폴백·auto 회의·카운트다운·채팅 개방·AI 배지·카피·에러 토스트)

**Files:**
- Create: `apps/mobile/src/lib/party-name.ts`
- Create: `apps/mobile/src/lib/__tests__/party-name.test.ts`
- Modify: `apps/mobile/app/(app)/party/[id].tsx`
- Modify: `apps/mobile/src/components/among/AmongGame.tsx`
- Modify: `apps/mobile/src/components/among/MeetingScreen.tsx`
- Modify: `apps/mobile/src/components/among/ResultScreen.tsx`
- Modify: `apps/mobile/src/components/among/RoleReveal.tsx`

**Interfaces:**
- Consumes: Task 1 타입(`reason "auto"`, `isAi`, `nextAutoMeetingAt`)
- Produces: `resolveDisplayName(profileId, participants: {profileId;name}[], amongPlayers: {profileId;name}[] | undefined, myProfileId: string | null): string`

- [ ] **Step 1: 실패하는 테스트 — 이름 폴백 순수 함수**

`party-name.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveDisplayName } from "../party-name";

const participants = [{ profileId: "p1", name: "유아영" }];
const amongPlayers = [
  { profileId: "p1", name: "유아영" },
  { profileId: "ai-1", name: "서지우" },
];

describe("resolveDisplayName", () => {
  it("나 → '나'", () => {
    expect(resolveDisplayName("p1", participants, amongPlayers, "p1")).toBe("나");
  });
  it("파티 참가자 이름 우선", () => {
    expect(resolveDisplayName("p1", participants, amongPlayers, null)).toBe("유아영");
  });
  it("참가자에 없으면 among.players로 폴백(AI 페르소나)", () => {
    expect(resolveDisplayName("ai-1", participants, amongPlayers, null)).toBe("서지우");
  });
  it("둘 다 없으면 '?'", () => {
    expect(resolveDisplayName("ghost", participants, undefined, null)).toBe("?");
  });
});
```

- [ ] **Step 2: 실패 확인 → 구현**

Run: `pnpm --filter @mingle/mobile test -- party-name` → FAIL 후 `party-name.ts`:

```ts
/** 파티 화면 공용 표시명 해석 — 파티 참가자 우선, 없으면 among 스냅샷(AI 페르소나) 폴백. */
export function resolveDisplayName(
  profileId: string,
  participants: ReadonlyArray<{ profileId: string; name: string }>,
  amongPlayers: ReadonlyArray<{ profileId: string; name: string }> | undefined,
  myProfileId: string | null,
): string {
  if (myProfileId !== null && profileId === myProfileId) return "나";
  return (
    participants.find((p) => p.profileId === profileId)?.name ??
    amongPlayers?.find((p) => p.profileId === profileId)?.name ??
    "?"
  );
}
```

Run → PASS.

- [ ] **Step 3: 파티 화면 적용**

`party/[id].tsx`:
- `characters` 조립의 name과 `senderName()`을 `resolveDisplayName(pid, party.participants, among?.players, myProfileId)` 호출로 교체(import 추가).
- `hideFab`에서 meeting/voting 제외(회의 = 토론장):

```tsx
  const hideFab =
    showAmong && among !== null && (among.phase === "ended" || (roleKnownButUnrevealed ?? false));
```

  단순화: `hideFab = showAmong && among?.phase === "ended"` — 리빌 중 겹침은 리빌 카드가 zIndex 100 전체 오버레이라 FAB 가림 허용. (기존 조건에서 meeting/voting 제거만 하면 됨.)
- `party:error` 토스트: `const [gameNotice, setGameNotice] = useState<string | null>(null);` — `openPartySocket`의 `onError` 콜백에서 `e?.message === "not-enough-players"` → "4명이 모여야 시작할 수 있어요", `"ai-unavailable"` → "AI 게임 준비 중이에요 — 잠시 후 다시 시도해주세요", 그 외 문자열 메시지는 그대로 표시. 표시: 상단바 아래 absolute 배너(`DoodleChip` 스타일 View, ink 반전), `setTimeout` 3s 자동 소멸(cleanup 포함).

```tsx
  useEffect(() => {
    if (!gameNotice) return;
    const t = setTimeout(() => setGameNotice(null), 3000);
    return () => clearTimeout(t);
  }, [gameNotice]);
```

- [ ] **Step 4: AmongGame — 자동 회의 카운트다운**

progress 행 옆에(진행률 바 아래 중앙) 카운트다운 배지 — 1s 틱은 기존 cooldown 틱 useEffect를 일반화(둘 다 필요 시 동작):

```tsx
  // among.nextAutoMeetingAt 기반 남은 초 — 진행 중에만 1s 틱
  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (!among?.nextAutoMeetingAt || among.phase !== "playing") return;
    const t = setInterval(() => setClockTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [among?.nextAutoMeetingAt, among?.phase]);
  const autoMeetingSec = among?.nextAutoMeetingAt
    ? Math.max(0, Math.ceil((among.nextAutoMeetingAt - Date.now()) / 1000))
    : null;
```

렌더(진행률 행에 추가):

```tsx
        {autoMeetingSec !== null && (
          <Text style={styles.autoMeetingText}>투표까지 {autoMeetingSec}s</Text>
        )}
```

스타일: `autoMeetingText: { fontSize: 11, color: colors.grayDark, minWidth: 70, textAlign: "right" }`.

- [ ] **Step 5: MeetingScreen / ResultScreen / RoleReveal**

MeetingScreen — reason 3분기(Vote 아이콘은 lucide `Vote`):

```tsx
import { Siren, Skull, Vote } from "lucide-react-native";
// ...
const icon =
  meeting.reason === "emergency" ? (
    <Siren color={colors.accent} size={20} strokeWidth={2.2} />
  ) : meeting.reason === "auto" ? (
    <Vote color={colors.ink} size={20} strokeWidth={2.2} />
  ) : (
    <Skull color={colors.ink} size={20} strokeWidth={2.2} />
  );
const reasonText =
  meeting.reason === "emergency" ? "긴급 회의" : meeting.reason === "auto" ? "정기 투표" : "시체 신고";
```

ResultScreen — 역할 라벨 옆 AI 배지(Bot 아이콘):

```tsx
import { Bot, Flag, PartyPopper, Skull, Wrench } from "lucide-react-native";
// playerRow 아이콘 분기 교체:
{p.isAi ? (
  <Bot color={colors.accent} size={20} strokeWidth={2.2} />
) : (
  <Wrench color={colors.grayDark} size={20} strokeWidth={2.2} />
)}
// roleLabel 텍스트: {p.isAi ? "AI" : "크루메이트"}{!p.alive ? " · 탈락" : ""}
// (isAi === 임포스터 — 임포스터 분기 자체를 isAi로 대체)
```

RoleReveal — 인간은 항상 crew이므로 크루 카피 교체:

```tsx
const label = isImpostor ? "당신은 임포스터" : "AI를 찾아라";
const sub = isImpostor
  ? "크루메이트를 처치하고 방해하세요!"
  : "파티에 AI 2명이 숨어 있어요.\n채팅과 행동으로 찾아내 투표하세요!";
```

(임포스터 분기는 도달 불가지만 타입상 유지.)

- [ ] **Step 6: 게이트 + Commit**

Run: `pnpm --filter @mingle/mobile test` → PASS(104+). `cd apps/mobile && npx tsc --noEmit` → 0. `npx prettier --check` 대상 파일 → clean.

```bash
git add apps/mobile
git commit -m "feat(mobile): AI를 찾아라 클라 — 페르소나 이름 폴백·정기 투표·카운트다운·AI 배지·에러 배너"
```

---

### Task 11: 도구·dev env — among-bots/seed-demo 정합 + dev 기본값

**Files:**
- Modify: `tools/among-bots.mjs`
- Modify: `tools/seed-demo.mjs` (어몽 슬로우플레이 부분 — 파일 열어 임포스터 전제 로직 확인)
- Modify: `apps/backend/.env` (dev 값 — 커밋 대상 아님: gitignore 확인 후 맞으면 `.env` 수정만 하고 커밋에서 제외, 대신 CLAUDE.md env 절에 기록)

**Interfaces:**
- Consumes: 새 게임 규칙(인간 전원 crew)
- Produces: 도구가 새 규칙에서 에러 없이 동작(봇 = 크루 플레이: 태스크 수행·회의 투표; 임포스터 킬 로직 제거)

- [ ] **Step 1: 갱신**

- `among-bots.mjs`: `--start` 모드 등에서 "임포스터 봇이 킬" 분기 제거 → 전 봇 크루 행동(태스크 수행, 회의 시 랜덤 인간/AI 투표 — 스냅샷 players 중 파티 참가자 목록에 없는 profileId(=AI)에 투표하는 `--hunt` 옵션 추가하면 수동 테스트 편의). 파일 열어 임포스터 의존 로직 전수 제거.
- `seed-demo.mjs`: 어몽 슬로우플레이 봇이 `myRole === "impostor"` 분기를 갖고 있으면 제거(크루 플레이만).
- `apps/backend/.env`에 dev 값 추가: `AMONG_AI_REQUIRE_LLM=false`, `AMONG_AUTO_MEETING_MS=45000`(관찰 편의), 그리고 기존 데모 튜닝 유지.

- [ ] **Step 2: 라이브 확인 + Commit**

백엔드 재시작 후: `node tools/seed-demo.mjs demo@qa.dev demo1234!` 정상 완주, `node tools/among-bots.mjs 4 --start` 게임 시작·AI 등장 로그 확인.

```bash
git add tools/among-bots.mjs tools/seed-demo.mjs
git commit -m "chore(tools): AI를 찾아라 규칙 정합 — 봇 전원 크루 플레이, --hunt 투표 옵션"
```

---

### Task 12: mega-qa 어몽 섹션 재작성

**Files:**
- Modify: `tools/mega-qa.mjs` (`sectionAmongUs` 전면 교체 + 헤더 ORDERING NOTE·체크 카운트 갱신)
- Modify: `.claude/skills/mega-qa/SKILL.md` (체크 수·어몽 설명 갱신)

**Interfaces:**
- Consumes: 새 게임 규칙 전부. 실행 환경 전제: dev `.env` = `AMONG_AI_REQUIRE_LLM=false`(Task 11).
- Produces: 새 체크 흐름(총 체크 수는 재작성 후 실측해 `MEGA-QA: N/N` 문구·스킬 문서에 반영):

1. 자동시작(기존 유지 — AUTO-START/FALLBACK 경로).
2. **역할 계약**: 4소켓 전원 `myRole === "crew"`, players에 파티 참가자 아닌 `ai-` 접두 2명 존재, 그들의 `role === null`(리댁션), 어떤 스냅샷에도 `isAi` 필드 부재.
3. **AI 생동**: 15초 내 `party:moved`에 `ai-` 접두 profileId 등장(state.moved 검사).
4. **긴급회의 #1**: 한 유저 emergency → meeting 수신 → 전원(4소켓) AI#1에 `among:vote` → 해소 대기 → AI#1 `alive === false` && phase "playing" 복귀(AI 1명 남아 게임 계속).
5. **긴급회의 #2**: 다른 유저(emergencyUsed 규칙) emergency → 전원 AI#2 투표 → **ended + result.winner === "crew" (reason "ejected")**.
6. **정체 공개**: ended 스냅샷에서 `isAi === true`가 정확히 2명이고 전원 `ai-` 접두.

- [ ] **Step 1: `sectionAmongUs` 교체**

기존 킬/신고 기반 체크(임포스터 식별·kill·report)를 삭제하고 위 6체크로 재작성. AI 식별 헬퍼:

```js
const aiIds = (snap) =>
  snap.players.filter((p) => !partyTags.some((t) => users[t].profileId === p.profileId)).map((p) => p.profileId);
```

투표 대기: 기존 `waitFor` + `amongEventCount` 패턴 재사용. 회의 해소 대기는 discussion(10s)+vote(15s) env 전제 — 여유 timeout 35s.
`파티에 잔재 유저가 섞인 경우`(공유 큐) aiIds가 잔재 인간도 AI로 오인 — 기존 하니스의 partyTags-subset 대응 노트에 맞춰 `p.profileId.startsWith("ai-")` 로 판별 기준을 바꾼다(간단·정확).

- [ ] **Step 2: 실행·카운트 확정**

백엔드(watch 재기동, dev env) 후 60초 간격 준수하며 `node tools/mega-qa.mjs` → 전 체크 PASS. 최종 카운트로 `MEGA-QA: N/N` 출력·헤더 주석·SKILL.md 문구 갱신.

- [ ] **Step 3: Commit**

```bash
git add tools/mega-qa.mjs .claude/skills/mega-qa/SKILL.md
git commit -m "test(mega-qa): AI를 찾아라 흐름으로 어몽 섹션 재작성 — AI 잠입·리댁션·2연속 추방·정체 공개"
```

---

### Task 13: 문서 + 전체 게이트

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/qa/2026-07-14-native-e2e-runbook.md` (§7에 AI 게임 항목)

- [ ] **Step 1: CLAUDE.md 갱신**

- 어몽 관련 줄들 갱신: 게임명 "AI를 찾아라(어몽 변형)" — **임포스터 = AI 전용(인간 전원 크루)**, AI 2명 LLM 페르소나(`LLM_API_URL` 없으면 `AMONG_AI_REQUIRE_LLM=false`일 때만 시작 가능 — 템플릿 대사), 주기 자동 회의 `AMONG_AUTO_MEETING_MS`.
- 어몽 env 줄에 신규 6개 키 추가. 승리 규칙 줄 유지(태스크 승리 동일).
- 게이트웨이 인메모리(humanPos·chatBuf) 단일 인스턴스 제약 한 줄.
- mega-qa 체크 수 갱신(N).

- [ ] **Step 2: 런북 §7 항목 추가**

```markdown
- [ ] AI를 찾아라: 시작 시 인원+2 캐릭터 등장(가짜 이름), AI가 돌아다니고 채팅함(LLM 켠 환경)
- [ ] 정기 투표 카운트다운 → 자동 회의 소집, 회의 중 채팅 열림
- [ ] AI 추방 2회 → 크루 승리, 결과 화면에 AI 배지 2개
- [ ] 인간에게 임포스터 리빌이 절대 나오지 않음
```

- [ ] **Step 3: 전체 게이트**

```bash
pnpm --filter @mingle/shared test && pnpm --filter @mingle/shared build
pnpm test   # client-core·backend·mobile 전부
cd apps/mobile && npx tsc --noEmit
# 백엔드 기동 상태에서 (60초 규칙 준수)
node tools/mega-qa.mjs   # N/N PASS
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/qa/2026-07-14-native-e2e-runbook.md
git commit -m "docs: AI를 찾아라 반영 — CLAUDE.md 규칙·env·mega-qa 카운트 + 런북 항목"
```

---

## 리스크·주의 (구현자용)

- **among.service.spec 대개편이 최대 리스크** — 기존 ~65 케이스 중 임포스터 전제(킬 주체, 회의 tally, 승패)가 전부 "AI가 임포스터"로 이동한다. `buildPlayingState` 픽스처를 한 번 제대로 바꾸면 대부분 기계적 치환.
- `AmongState`에 필드 추가 시 **진행 중 구세션**(배포 전 시작)은 `ai`/`nextAutoMeetingAt` 없음 — 스윕·projection에서 `state.ai?.bots ?? {}`, `state.nextAutoMeetingAt ?? Infinity` 방어(런타임 크래시 금지). Task 6~9 구현 공통.
- LLM 실호출은 어떤 테스트에서도 금지(fetch 목) — 실 LLM은 수동 스모크만.
- 게이트웨이 unguarded 예외 = 과거 프로세스 크래시 전과(2392fdb) — 신규 비동기 경로(`sayAsAi`/`castAiVote`/스윕)는 전부 try/catch 필수.
- `party:message` AI 발화는 DB 미저장 — `getPartyMessages` 히스토리에 없음이 정상(문서에 명시).
- shared 빌드 선행 잊지 말 것(backend가 CJS require).
