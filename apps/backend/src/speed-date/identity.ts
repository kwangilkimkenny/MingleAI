/**
 * Ephemeral per-session identity for the blind speed date: a nickname and a static
 * avatar (character image). These replace real name/photo entirely during the session —
 * they are not derived from the profile, so nothing about the real person leaks through
 * the blind stages. Assignment is random-but-distinct within a session.
 */

const NICK_ADJ = [
  "노을",
  "바다",
  "구름",
  "별빛",
  "숲속",
  "달빛",
  "물결",
  "햇살",
  "안개",
  "새벽",
] as const;

const NICK_NOUN = [
  "여우",
  "사슴",
  "고래",
  "수달",
  "부엉이",
  "다람쥐",
  "고양이",
  "펭귄",
  "너구리",
  "토끼",
] as const;

/** Static avatar image ids — the mobile app maps each to a bundled character image. */
const AVATAR_POOL = [
  "av-coral",
  "av-mint",
  "av-plum",
  "av-amber",
  "av-sky",
  "av-moss",
  "av-rose",
  "av-slate",
] as const;

export interface SessionIdentity {
  nickname: string;
  avatarId: string;
}

function shuffled<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assign a distinct nickname + avatar to each profile id. Nicknames combine a random
 * adjective + noun and are de-duplicated; avatars are drawn without replacement from the
 * pool (caller must not exceed AVATAR_POOL.length participants — the 3×3 mode uses 6).
 */
export function assignIdentities(profileIds: string[]): Record<string, SessionIdentity> {
  const avatars = shuffled(AVATAR_POOL);
  const usedNicks = new Set<string>();
  const out: Record<string, SessionIdentity> = {};
  profileIds.forEach((id, i) => {
    let nickname = "";
    for (let attempt = 0; attempt < 50; attempt++) {
      const adj = NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)];
      const noun = NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
      const candidate = `${adj} ${noun}`;
      if (!usedNicks.has(candidate)) {
        nickname = candidate;
        break;
      }
    }
    if (!nickname) nickname = `게스트 ${i + 1}`;
    usedNicks.add(nickname);
    out[id] = { nickname, avatarId: avatars[i % avatars.length] };
  });
  return out;
}
