import type { GameReveal } from "@mingle/shared";

export interface BalanceConnectionHighlight {
  peerId: string;
  peerName: string;
  sharedCount: number;
  answeredRounds: number;
  latestSharedChoice: string;
}

/**
 * Finds the human party member who most often made the same revealed balance-game choice.
 * Current-round votes never enter this function, so the existing hidden-vote contract stays intact.
 */
export function strongestBalanceConnection(
  reveals: GameReveal[],
  myProfileId: string,
  peers: { profileId: string; name: string }[],
): BalanceConnectionHighlight | null {
  const peersById = new Map(peers.map((peer) => [peer.profileId, peer.name]));
  const scores = new Map<string, { sharedCount: number; latestSharedChoice: string }>();
  let answeredRounds = 0;

  for (const reveal of reveals) {
    const choseA = reveal.aVoters.includes(myProfileId);
    const choseB = reveal.bVoters.includes(myProfileId);
    if (!choseA && !choseB) continue;
    answeredRounds += 1;

    const myGroup = choseA ? reveal.aVoters : reveal.bVoters;
    const choice = choseA ? reveal.question.a : reveal.question.b;
    for (const profileId of myGroup) {
      if (profileId === myProfileId || !peersById.has(profileId)) continue;
      const current = scores.get(profileId) ?? { sharedCount: 0, latestSharedChoice: choice };
      scores.set(profileId, {
        sharedCount: current.sharedCount + 1,
        latestSharedChoice: choice,
      });
    }
  }

  const best = [...scores.entries()].sort((a, b) => {
    if (b[1].sharedCount !== a[1].sharedCount) return b[1].sharedCount - a[1].sharedCount;
    return (peersById.get(a[0]) ?? "").localeCompare(peersById.get(b[0]) ?? "", "ko");
  })[0];
  if (!best) return null;

  return {
    peerId: best[0],
    peerName: peersById.get(best[0])!,
    sharedCount: best[1].sharedCount,
    answeredRounds,
    latestSharedChoice: best[1].latestSharedChoice,
  };
}
