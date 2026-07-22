/**
 * PARTY_MAP — 파티장 맵의 단일 진실(single source of truth).
 * 모바일 클라이언트(렌더·충돌·카메라)와 백엔드(어몽 태스크 배치·AI 이동)가 공유한다.
 *
 * 좌표계: 방은 정규화 [0,1]² 이되, 렌더·거리·충돌은 "world 계량"을 쓴다 —
 * world 좌표 = (x × WORLD_ASPECT, y). 즉 세로(높이)가 1 world 단위.
 * 월드는 화면보다 크게 렌더되고 카메라가 내 캐릭터를 따라 스크롤한다(레터박스 아님).
 *
 * 구조: 여러 룸(rooms)이 벽(walls)으로 나뉘고 문(door gap)으로 이어진다. 중앙 수평 복도
 * (top 룸 아래 ~ bottom 룸 위, y≈0.40~0.57)가 모든 룸을 연결하는 전역 통로 — 벽 배치가
 * 어긋나도 복도로 항상 연결된다. 벽은 클라 충돌 전용(백엔드는 rooms/walls 미참조 — AI는
 * 벽을 무시하고 직진, 파인딩 없음). spawnZone은 회의실(HUB) 상단 개방부.
 */

export const WORLD_ASPECT = 3.0;
/** 캐릭터 충돌 반지름 (world 단위 = 방 높이 기준). */
export const CHAR_R = 0.035;
/** 방 가장자리 여백 (정규화, 양 축 동일). 월드 경계 clamp에 쓰임. */
export const ROOM_MARGIN = 0.03;
/** Human avatar movement speed. Shared so client prediction and server validation agree. */
export const PARTY_MOVE_SPEED = 0.45;
/** 로비 밸런스 게임 스테이션 id (DJ 부스 앞). */
export const BALANCE_STATION_ID = "st-dj";

export type FurnitureKind = "bar" | "table" | "sofa" | "stage" | "dj" | "plant" | "rug";

/** 정규화 좌표 AABB. */
export interface FurnitureDef {
  id: string;
  kind: FurnitureKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DecoKind = "window" | "frame" | "stringlights" | "stain";

/** 비충돌 장식 레이어 — 클라 렌더 전용(충돌/좌표 판정에 미포함). */
export interface DecoDef {
  id: string;
  kind: DecoKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 태스크/상호작용 스테이션 앵커 — 통행 가능 지점(가구 인접). */
export interface StationDef {
  id: string;
  x: number;
  y: number;
  furnitureId: string;
}

/** 방(룸) — 바닥 틴트 + 라벨 + 벽 생성의 기준. 정규화 AABB. */
export interface RoomDef {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 벽 세그먼트(정규화 AABB) — 클라 충돌·렌더 전용. 룸 둘레에서 문(gap)을 뺀 조각. */
export interface WallDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PartyMapDef {
  aspect: number;
  furniture: readonly FurnitureDef[];
  stations: readonly StationDef[];
  /** 가구 없는 스폰 영역(회의실 HUB 상단) — 정규화 rect. */
  spawnZone: { x: number; y: number; w: number; h: number };
  /** 룸(바닥 틴트 + 라벨) — 클라 렌더 전용. */
  rooms?: readonly RoomDef[];
  /** 벽 세그먼트 — 클라 충돌·렌더 전용(백엔드 미참조). */
  walls?: readonly WallDef[];
  /** 비충돌 장식 요소 — 클라 렌더 전용. */
  deco?: readonly DecoDef[];
}

const WALKABLE_KINDS: ReadonlySet<FurnitureKind> = new Set(["rug", "stage"]);

export function isSolid(kind: FurnitureKind): boolean {
  return !WALKABLE_KINDS.has(kind);
}

export function solidFurniture(map: PartyMapDef = PARTY_MAP): FurnitureDef[] {
  return map.furniture.filter((f) => isSolid(f.kind));
}

// ── 룸 + 문 정의 → 벽 세그먼트 생성 ────────────────────────────────────────
const WALL_T = 0.012; // 벽 두께(정규화)

type DoorSide = "top" | "bottom" | "left" | "right";
interface Door {
  side: DoorSide;
  /** top/bottom이면 x 좌표, left/right이면 y 좌표(정규화). */
  at: number;
  size: number;
}

/** 룸 둘레 4변에서 door gap을 제외한 벽 조각들. 문은 항상 CHAR_R 지름보다 넓게. */
function roomWalls(r: RoomDef, doors: Door[]): WallDef[] {
  const t = WALL_T;
  const out: WallDef[] = [];
  const sides: { side: DoorSide; horiz: boolean; fixed: number; from: number; to: number }[] = [
    { side: "top", horiz: true, fixed: r.y, from: r.x, to: r.x + r.w },
    { side: "bottom", horiz: true, fixed: r.y + r.h - t, from: r.x, to: r.x + r.w },
    { side: "left", horiz: false, fixed: r.x, from: r.y, to: r.y + r.h },
    { side: "right", horiz: false, fixed: r.x + r.w - t, from: r.y, to: r.y + r.h },
  ];
  for (const s of sides) {
    const gaps = doors
      .filter((d) => d.side === s.side)
      .map((d) => [d.at - d.size / 2, d.at + d.size / 2] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    let cursor = s.from;
    const segs: [number, number][] = [];
    for (const [g0, g1] of gaps) {
      if (g0 > cursor) segs.push([cursor, g0]);
      cursor = Math.max(cursor, g1);
    }
    if (cursor < s.to) segs.push([cursor, s.to]);
    for (const [a, b] of segs) {
      if (b - a <= 0.001) continue;
      if (s.horiz) out.push({ x: a, y: s.fixed, w: b - a, h: t });
      else out.push({ x: s.fixed, y: a, w: t, h: b - a });
    }
  }
  return out;
}

const ROOMS: readonly RoomDef[] = [
  // 상단 밴드 (y 0.08 ~ 0.42)
  { id: "lounge", name: "라운지", x: 0.04, y: 0.09, w: 0.2, h: 0.31 },
  { id: "meeting", name: "회의실", x: 0.3, y: 0.08, w: 0.22, h: 0.32 },
  { id: "elec", name: "전기실", x: 0.58, y: 0.09, w: 0.15, h: 0.29 },
  { id: "stage", name: "무대", x: 0.79, y: 0.08, w: 0.17, h: 0.34 },
  // 하단 밴드 (y 0.57 ~ 0.92)
  { id: "garden", name: "정원", x: 0.06, y: 0.58, w: 0.21, h: 0.33 },
  { id: "dance", name: "댄스홀", x: 0.35, y: 0.57, w: 0.31, h: 0.35 },
  { id: "machine", name: "기계실", x: 0.74, y: 0.58, w: 0.22, h: 0.33 },
];

// 문: top/bottom은 x, left/right은 y. 하단 door는 중앙 복도(y≈0.40~0.57)로 열림.
const DOORS: Record<string, Door[]> = {
  lounge: [
    { side: "bottom", at: 0.14, size: 0.1 },
    { side: "right", at: 0.24, size: 0.1 },
  ],
  meeting: [
    { side: "bottom", at: 0.41, size: 0.11 },
    { side: "left", at: 0.24, size: 0.1 },
    { side: "right", at: 0.24, size: 0.1 },
  ],
  elec: [
    { side: "bottom", at: 0.655, size: 0.1 },
    { side: "left", at: 0.23, size: 0.1 },
  ],
  stage: [{ side: "bottom", at: 0.875, size: 0.1 }],
  garden: [
    { side: "top", at: 0.16, size: 0.1 },
    { side: "right", at: 0.74, size: 0.1 },
  ],
  dance: [
    { side: "top", at: 0.5, size: 0.12 },
    { side: "left", at: 0.74, size: 0.1 },
    { side: "right", at: 0.74, size: 0.1 },
  ],
  machine: [
    { side: "top", at: 0.85, size: 0.1 },
    { side: "left", at: 0.74, size: 0.1 },
  ],
};

const WALLS: readonly WallDef[] = ROOMS.flatMap((r) => roomWalls(r, DOORS[r.id] ?? []));

export const PARTY_MAP: PartyMapDef = {
  aspect: WORLD_ASPECT,
  rooms: ROOMS,
  walls: WALLS,
  furniture: [
    // 라운지: 바 + 소파
    { id: "bar", kind: "bar", x: 0.06, y: 0.12, w: 0.15, h: 0.06 },
    { id: "sofa", kind: "sofa", x: 0.06, y: 0.23, w: 0.13, h: 0.055 },
    // 회의실(HUB): 라운드 테이블 (스폰은 그 위)
    { id: "table-1", kind: "table", x: 0.36, y: 0.2, w: 0.07, h: 0.08 },
    // 전기실: 라운드 테이블
    { id: "table-2", kind: "table", x: 0.61, y: 0.15, w: 0.07, h: 0.08 },
    // 무대: 무대(통행) + DJ 부스(solid)
    { id: "stage", kind: "stage", x: 0.8, y: 0.22, w: 0.14, h: 0.14 },
    { id: "dj", kind: "dj", x: 0.82, y: 0.12, w: 0.09, h: 0.06 },
    // 정원: 화분
    { id: "plant-a", kind: "plant", x: 0.09, y: 0.63, w: 0.045, h: 0.075 },
    // 기계실: 화분
    { id: "plant-b", kind: "plant", x: 0.85, y: 0.72, w: 0.045, h: 0.075 },
    // 댄스홀: 댄스플로어 러그(통행)
    { id: "rug", kind: "rug", x: 0.4, y: 0.62, w: 0.22, h: 0.24 },
  ],
  stations: [
    { id: "st-bar", x: 0.205, y: 0.34, furnitureId: "bar" },
    { id: "st-sofa", x: 0.13, y: 0.335, furnitureId: "sofa" },
    { id: "st-table-1", x: 0.395, y: 0.33, furnitureId: "table-1" },
    { id: "st-table-2", x: 0.645, y: 0.28, furnitureId: "table-2" },
    // DJ 부스 하단에서 캐릭터 반지름(0.035) 이상의 여유를 확보한다.
    { id: "st-dj", x: 0.83, y: 0.22, furnitureId: "dj" },
    { id: "st-stage", x: 0.87, y: 0.3, furnitureId: "stage" },
    { id: "st-plant-a", x: 0.17, y: 0.7, furnitureId: "plant-a" },
    { id: "st-plant-b", x: 0.8, y: 0.78, furnitureId: "plant-b" },
  ],
  // 회의실 상단 벽과 table-1 사이의 실제 통행 가능 띠. CHAR_R 확장 후에도 양쪽과 비충돌.
  spawnZone: { x: 0.33, y: 0.13, w: 0.15, h: 0.03 },
  deco: [
    { id: "win-1", kind: "window", x: 0.35, y: 0.045, w: 0.1, h: 0.055 },
    { id: "win-2", kind: "window", x: 0.83, y: 0.045, w: 0.1, h: 0.06 },
    { id: "frame-1", kind: "frame", x: 0.06, y: 0.045, w: 0.05, h: 0.055 },
    { id: "lights", kind: "stringlights", x: 0.03, y: 0.012, w: 0.94, h: 0.035 },
    { id: "stain-1", kind: "stain", x: 0.48, y: 0.72, w: 0.05, h: 0.03 },
    { id: "stain-2", kind: "stain", x: 0.14, y: 0.8, w: 0.045, h: 0.028 },
  ],
};

/** world 계량 거리 — 렌더 스케일과 일치하는 등방 거리(모바일 판정·백엔드 AI 근접 공용). */
export function worldDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot((b.x - a.x) * WORLD_ASPECT, b.y - a.y);
}

/** Stable spawn point derived from a profile id. */
export function partySpawnFor(profileId: string, map: PartyMapDef = PARTY_MAP) {
  let hash = 5381;
  for (let i = 0; i < profileId.length; i += 1) {
    hash = ((hash << 5) + hash + profileId.charCodeAt(i)) >>> 0;
  }
  const gx = (hash % 1000) / 1000;
  const gy = (Math.floor(hash / 1000) % 1000) / 1000;
  const zone = map.spawnZone;
  return { x: zone.x + gx * zone.w, y: zone.y + gy * zone.h };
}

/** Server-safe point validation, including avatar radius around walls and solid furniture. */
export function isPartyPositionWalkable(
  point: { x: number; y: number },
  map: PartyMapDef = PARTY_MAP,
): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  if (
    point.x < ROOM_MARGIN ||
    point.x > 1 - ROOM_MARGIN ||
    point.y < ROOM_MARGIN ||
    point.y > 1 - ROOM_MARGIN
  ) {
    return false;
  }

  const worldX = point.x * map.aspect;
  const obstacles = [...solidFurniture(map), ...(map.walls ?? [])];
  return !obstacles.some((rect) => {
    const left = rect.x * map.aspect - CHAR_R;
    const right = (rect.x + rect.w) * map.aspect + CHAR_R;
    const top = rect.y - CHAR_R;
    const bottom = rect.y + rect.h + CHAR_R;
    return worldX > left && worldX < right && point.y > top && point.y < bottom;
  });
}

/**
 * Rejects teleporting and wall tunnelling. Sampling the short (10 Hz) segment keeps this
 * deterministic and cheap while validating the entire path, not just its destination.
 */
export function isPlausiblePartyMove(
  from: { x: number; y: number },
  to: { x: number; y: number },
  elapsedMs: number,
  map: PartyMapDef = PARTY_MAP,
): boolean {
  if (!isPartyPositionWalkable(from, map) || !isPartyPositionWalkable(to, map)) return false;
  const elapsed = Math.min(Math.max(Number.isFinite(elapsedMs) ? elapsedMs : 0, 50), 1000);
  const distance = worldDist(from, to);
  // A small network/prediction allowance avoids false rejection at normal 10 Hz cadence.
  if (distance > PARTY_MOVE_SPEED * (elapsed / 1000) + 0.035) return false;
  const steps = Math.max(1, Math.ceil(distance / 0.015));
  for (let i = 1; i <= steps; i += 1) {
    const ratio = i / steps;
    if (
      !isPartyPositionWalkable(
        { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio },
        map,
      )
    ) {
      return false;
    }
  }
  return true;
}
