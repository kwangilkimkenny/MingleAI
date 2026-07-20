/**
 * character-look — profileId/name 시드로 캐릭터 외형 파츠를 결정적으로 선택하는 순수 함수.
 * DoodleCharacter가 이 결과로 헤어/상의/표정/볼터치를 렌더 분기한다(파츠 렌더는 컴포넌트 소관).
 */
export type Hair = "short" | "bob" | "ponytail" | "curly" | "twoblock" | "bowl";
export type Outfit = "tee" | "hoodie" | "overall" | "dress";
export type Eyes = "dot" | "half" | "round";
export type Mouth = "smile" | "o" | "line";

export const HAIRS: readonly Hair[] = ["short", "bob", "ponytail", "curly", "twoblock", "bowl"];
export const OUTFITS: readonly Outfit[] = ["tee", "hoodie", "overall", "dress"];
export const EYES_SET: readonly Eyes[] = ["dot", "half", "round"];
export const MOUTHS: readonly Mouth[] = ["smile", "o", "line"];

export interface CharacterLook {
  hair: Hair;
  outfit: Outfit;
  eyes: Eyes;
  mouth: Mouth;
  accent: "cheek" | "string";
  seed: number;
}

/** djb2 계열 해시 — key당 결정적 uint32. */
function hash(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

export function lookFor(key: string): CharacterLook {
  const h = hash(key);
  // 서로 겹치지 않는 비트 구간에서 각 파츠 인덱스 추출(파츠 간 상관 최소화).
  return {
    hair: HAIRS[h % HAIRS.length]!,
    outfit: OUTFITS[(h >>> 3) % OUTFITS.length]!,
    eyes: EYES_SET[(h >>> 6) % EYES_SET.length]!,
    mouth: MOUTHS[(h >>> 9) % MOUTHS.length]!,
    accent: (h >>> 12) % 2 === 0 ? "cheek" : "string",
    seed: (h % 97) + 1,
  };
}
