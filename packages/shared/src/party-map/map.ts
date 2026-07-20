/**
 * PARTY_MAP — 파티장 맵의 단일 진실(single source of truth).
 * 모바일 클라이언트(렌더·충돌)와 백엔드(어몽 태스크 배치)가 공유한다.
 *
 * 좌표계: 방은 정규화 [0,1]² 이되, 렌더·거리·충돌은 "world 계량"을 쓴다 —
 * world 좌표 = (x × WORLD_ASPECT, y). 즉 세로(높이)가 1 world 단위.
 * 화면에는 WORLD_ASPECT 비율로 aspect-fit(레터박스)되어 픽셀 스케일이 등방이 된다.
 */

export const WORLD_ASPECT = 1.9;
/** 캐릭터 충돌 반지름 (world 단위 = 방 높이 기준). */
export const CHAR_R = 0.035;
/** 방 가장자리 여백 (정규화, 양 축 동일 — 기존 party-space 값 이관). */
export const ROOM_MARGIN = 0.06;
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

/** 태스크/상호작용 스테이션 앵커 — 통행 가능 지점(가구 인접). */
export interface StationDef {
  id: string;
  x: number;
  y: number;
  furnitureId: string;
}

export interface PartyMapDef {
  aspect: number;
  furniture: readonly FurnitureDef[];
  stations: readonly StationDef[];
  /** 가구 없는 스폰 영역(댄스플로어) — 정규화 rect. */
  spawnZone: { x: number; y: number; w: number; h: number };
}

const WALKABLE_KINDS: ReadonlySet<FurnitureKind> = new Set(["rug", "stage"]);

export function isSolid(kind: FurnitureKind): boolean {
  return !WALKABLE_KINDS.has(kind);
}

export function solidFurniture(map: PartyMapDef = PARTY_MAP): FurnitureDef[] {
  return map.furniture.filter((f) => isSolid(f.kind));
}

export const PARTY_MAP: PartyMapDef = {
  aspect: WORLD_ASPECT,
  furniture: [
    // 좌상: 바 카운터
    { id: "bar", kind: "bar", x: 0.08, y: 0.1, w: 0.18, h: 0.1 },
    // 좌중: 화분
    { id: "plant-a", kind: "plant", x: 0.08, y: 0.42, w: 0.05, h: 0.09 },
    // 좌하: 소파
    { id: "sofa", kind: "sofa", x: 0.08, y: 0.72, w: 0.16, h: 0.1 },
    // 우상: 무대(통행 가능) 위 DJ 부스(solid)
    { id: "stage", kind: "stage", x: 0.74, y: 0.1, w: 0.18, h: 0.22 },
    { id: "dj", kind: "dj", x: 0.78, y: 0.12, w: 0.1, h: 0.08 },
    // 중앙 하단: 라운드 테이블 2개
    { id: "table-1", kind: "table", x: 0.34, y: 0.62, w: 0.09, h: 0.14 },
    { id: "table-2", kind: "table", x: 0.57, y: 0.62, w: 0.09, h: 0.14 },
    // 우하: 화분
    { id: "plant-b", kind: "plant", x: 0.87, y: 0.76, w: 0.05, h: 0.09 },
    // 중앙: 댄스플로어 러그(통행 가능 장식)
    { id: "rug", kind: "rug", x: 0.36, y: 0.22, w: 0.28, h: 0.32 },
  ],
  stations: [
    { id: "st-bar", x: 0.17, y: 0.26, furnitureId: "bar" },
    { id: "st-plant-a", x: 0.17, y: 0.46, furnitureId: "plant-a" },
    { id: "st-sofa", x: 0.16, y: 0.66, furnitureId: "sofa" },
    { id: "st-table-1", x: 0.385, y: 0.56, furnitureId: "table-1" },
    { id: "st-table-2", x: 0.615, y: 0.56, furnitureId: "table-2" },
    { id: "st-dj", x: 0.73, y: 0.17, furnitureId: "dj" },
    { id: "st-stage", x: 0.83, y: 0.38, furnitureId: "stage" },
    { id: "st-plant-b", x: 0.84, y: 0.72, furnitureId: "plant-b" },
  ],
  spawnZone: { x: 0.4, y: 0.26, w: 0.2, h: 0.24 },
};

/** world 계량 거리 — 렌더 aspect-fit과 일치하는 등방 거리(모바일 판정·백엔드 AI 근접 공용). */
export function worldDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot((b.x - a.x) * WORLD_ASPECT, b.y - a.y);
}
