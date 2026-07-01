import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MatchmakingConfigProvider } from "./matchmaking.config";
import { preferenceScore } from "@mingle/shared";
import type { PreferenceSignals } from "@mingle/shared";

type Entry = {
  id: string;
  profileId: string;
  status: string;
  matchedPartyId: string | null;
  preferenceSnapshot: unknown;
  enqueuedAt: Date;
};

@Injectable()
export class MatchmakingSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MatchmakingSweepService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configProvider: MatchmakingConfigProvider,
  ) {}

  private get cfg() {
    return this.configProvider.value;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, this.cfg.sweepMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runSweep(new Date());
    } catch (e) {
      this.log.warn(`sweep failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async runSweep(now: Date): Promise<{ formed: number; cancelled: number }> {
    const waiting = (await this.prisma.matchmakingQueueEntry.findMany({
      where: { status: "waiting" },
      orderBy: { enqueuedAt: "asc" },
    })) as unknown as Entry[];

    let cancelled = 0;

    // dedupe: one entry per profile (oldest, since ordered asc); cancel extras so a
    // profile can never be placed in a second party on a later tick.
    const seen = new Set<string>();
    const deduped: Entry[] = [];
    for (const e of waiting) {
      if (!seen.has(e.profileId)) {
        seen.add(e.profileId);
        deduped.push(e);
      } else {
        // enqueue race can leave a profile with >1 waiting entry; cancel the extras
        // so it can never be pulled into a second party on a later tick.
        const r = await this.prisma.matchmakingQueueEntry.updateMany({
          where: { id: e.id, status: "waiting" },
          data: { status: "cancelled" },
        });
        if (r.count) cancelled++;
      }
    }

    // timeout pass
    const active: Entry[] = [];
    for (const e of deduped) {
      if (now.getTime() - new Date(e.enqueuedAt).getTime() > this.cfg.maxWaitMs) {
        const r = await this.prisma.matchmakingQueueEntry.updateMany({
          where: { id: e.id, status: "waiting" },
          data: { status: "cancelled" },
        });
        if (r.count) cancelled++;
      } else {
        active.push(e);
      }
    }

    // formation pass
    let formed = 0;
    const pool = [...active];
    while (pool.length >= this.cfg.min) {
      const anchor = pool.shift()!;
      try {
        const anchorElapsed = now.getTime() - new Date(anchor.enqueuedAt).getTime();
        const threshold = this.cfg.baseThreshold * Math.max(0, 1 - anchorElapsed / this.cfg.maxWaitMs);
        const anchorSig = anchor.preferenceSnapshot as PreferenceSignals;

        const ranked = pool
          .map((e) => ({ e, s: preferenceScore(anchorSig, e.preferenceSnapshot as PreferenceSignals) }))
          .filter((x) => x.s >= threshold)
          .sort((a, b) => b.s - a.s)
          .slice(0, this.cfg.max - 1);

        if (1 + ranked.length >= this.cfg.min) {
          const group = [anchor, ...ranked.map((x) => x.e)];
          const ok = await this.formParty(group, now);
          if (ok) {
            formed++;
            const ids = new Set(ranked.map((x) => x.e.id));
            for (let i = pool.length - 1; i >= 0; i--) if (ids.has(pool[i].id)) pool.splice(i, 1);
          }
        }
        // if not formed, the anchor is simply dropped from this tick (stays waiting in DB)
      } catch (e) {
        this.log.warn(`anchor ${anchor.id} skipped: ${(e as Error).message}`);
      }
    }

    return { formed, cancelled };
  }

  async formParty(group: Entry[], now: Date): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const e of group) {
          const r = await tx.matchmakingQueueEntry.updateMany({
            where: { id: e.id, status: "waiting" },
            data: { status: "matched" },
          });
          if (r.count === 0) throw new Error("entry already claimed");
        }
        const party = await tx.party.create({
          data: {
            name: `파티 ${now.getTime().toString(36).slice(-5)}`,
            status: "active",
            startedAt: now,
            maxParticipants: this.cfg.max,
          },
        });
        await tx.partyParticipant.createMany({
          data: group.map((e) => ({ partyId: party.id, profileId: e.profileId })),
        });
        await tx.matchmakingQueueEntry.updateMany({
          where: { id: { in: group.map((e) => e.id) } },
          data: { matchedPartyId: party.id },
        });
      });
      return true;
    } catch (e) {
      this.log.warn(`formParty rolled back: ${(e as Error).message}`);
      return false;
    }
  }
}
