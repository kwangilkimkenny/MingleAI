import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  preferenceScore,
  blockPairKey,
  withinMutualRadius,
  type PreferenceSignals,
  type Coords,
} from "@mingle/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SafetyService } from "../safety/safety.service";
import { SpeedDateConfigProvider } from "./speed-date.config";
import { SpeedDateSessionService } from "./speed-date-session.service";
import { assignIdentities } from "./identity";
import type { SpeedDateParticipant } from "./speed-date.state";

type Entry = {
  id: string;
  profileId: string;
  gender: string;
  status: string;
  preferenceSnapshot: unknown;
  enqueuedAt: Date;
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
};

/** Project a queue entry (or an AI slot's null entry) to geo shape for withinMutualRadius.
 * `== null` catches both null and undefined so entries without coords never constrain matching. */
function geoOf(e: Entry | null): { coords: Coords | null; radiusKm: number | null } {
  if (!e || e.lat == null || e.lng == null) return { coords: null, radiusKm: e?.radiusKm ?? null };
  return { coords: { lat: e.lat, lng: e.lng }, radiusKm: e.radiusKm };
}

/** A candidate slot — a real queue entry or a synthetic AI fill (dev only, no DB row). */
type Slot = { profileId: string; gender: string; entry: Entry | null; isAi: boolean };

/**
 * Forms blind-date sessions from the gender-aware queue: FIFO fairness, block exclusion, and a
 * wait-decayed preference threshold (mirrors the party matchmaking sweep). Single-instance only,
 * like every other `setInterval` sweep in the app. Session phase advancement lives in the gateway.
 */
@Injectable()
export class SpeedDateSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SpeedDateSweepService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configProvider: SpeedDateConfigProvider,
    private readonly safety: SafetyService,
    private readonly sessions: SpeedDateSessionService,
  ) {}

  private get cfg() {
    return this.configProvider.value;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), this.cfg.sweepMs);
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

  async runSweep(now: Date): Promise<{ formed: number }> {
    const waiting = (await this.prisma.speedDateQueueEntry.findMany({
      where: { status: "waiting" },
      orderBy: { enqueuedAt: "asc" },
    })) as unknown as Entry[];

    // Cancel waiting entries whose owner is already inside an ACTIVE session — a re-enqueue can
    // race the formation transaction (enqueue's active-session guard passes before the session
    // row commits), and without this pass the next sweep would pull a mid-session user into a
    // second session.
    const inSession = await this.activeParticipantIds();

    // dedupe: one waiting entry per profile (cancel extras defensively)
    const seen = new Set<string>();
    const deduped: Entry[] = [];
    for (const e of waiting) {
      if (seen.has(e.profileId) || inSession.has(e.profileId)) {
        await this.prisma.speedDateQueueEntry.updateMany({
          where: { id: e.id, status: "waiting" },
          data: { status: "cancelled" },
        });
        continue;
      }
      seen.add(e.profileId);
      deduped.push(e);
    }

    // timeout pass
    const active: Entry[] = [];
    for (const e of deduped) {
      if (now.getTime() - new Date(e.enqueuedAt).getTime() > this.cfg.maxWaitMs) {
        await this.prisma.speedDateQueueEntry.updateMany({
          where: { id: e.id, status: "waiting" },
          data: { status: "timeout" },
        });
      } else {
        active.push(e);
      }
    }

    const per = this.cfg.groupPerGender;
    const males = active.filter((e) => e.gender === "male");
    const females = active.filter((e) => e.gender === "female");
    const blocked = await this.safety.blocksForProfiles(active.map((e) => e.profileId));

    // block-excluding FIFO pick: reject a candidate blocked with anyone already selected
    const pick = (pool: Entry[], count: number, selected: Slot[]): Slot[] => {
      const out: Slot[] = [];
      for (const e of pool) {
        if (out.length >= count) break;
        // Reject a candidate blocked with — or outside the mutual radius of — anyone already picked,
        // so every member of a formed group is pairwise within each other's chosen distance.
        const conflict = [...selected, ...out].some(
          (s) =>
            blocked.has(blockPairKey(s.profileId, e.profileId)) ||
            !withinMutualRadius(geoOf(e), geoOf(s.entry)),
        );
        if (!conflict) out.push({ profileId: e.profileId, gender: e.gender, entry: e, isAi: false });
      }
      return out;
    };

    const maleSlots = pick(males, per, []);
    const femaleSlots = pick(females, per, maleSlots);

    // dev-only AI fill for missing slots — but never form an all-AI session: with an empty queue
    // that would mint a new session every tick forever (450k-row incident, 2026-08-06).
    const realCount = maleSlots.length + femaleSlots.length;
    if (this.cfg.aiFill && realCount > 0) {
      while (maleSlots.length < per) maleSlots.push(this.aiSlot("male"));
      while (femaleSlots.length < per) femaleSlots.push(this.aiSlot("female"));
    }
    if (maleSlots.length < per || femaleSlots.length < per) return { formed: 0 };

    // wait-decayed threshold gate over real cross pairs (all-AI groups pass)
    const anchorElapsed = active.length > 0 ? now.getTime() - new Date(active[0].enqueuedAt).getTime() : 0;
    const threshold = this.cfg.baseThreshold * Math.max(0, 1 - anchorElapsed / this.cfg.maxWaitMs);
    const avg = this.avgCrossScore(maleSlots, femaleSlots);
    if (avg !== null && avg < threshold) return { formed: 0 };

    const slots = [...maleSlots, ...femaleSlots];
    const identities = assignIdentities(slots.map((s) => s.profileId));
    const participants: SpeedDateParticipant[] = slots.map((s) => ({
      profileId: s.profileId,
      gender: s.gender,
      nickname: identities[s.profileId].nickname,
      avatarId: identities[s.profileId].avatarId,
      isAi: s.isAi,
    }));
    const realEntryIds = slots.filter((s) => s.entry).map((s) => s.entry!.id);

    const sessionId = await this.sessions.createSession(
      realEntryIds,
      participants,
      maleSlots.map((s) => s.profileId),
      femaleSlots.map((s) => s.profileId),
      now,
    );
    return { formed: sessionId ? 1 : 0 };
  }

  /** Profile ids of everyone currently inside an active session (participants live in state JSON). */
  private async activeParticipantIds(): Promise<Set<string>> {
    const sessions = await this.prisma.speedDateSession.findMany({
      where: { status: "active" },
      select: { state: true },
    });
    const ids = new Set<string>();
    for (const s of sessions) {
      const participants =
        (s.state as { participants?: Array<{ profileId: string }> })?.participants ?? [];
      for (const p of participants) ids.add(p.profileId);
    }
    return ids;
  }

  private aiSlot(gender: string): Slot {
    return { profileId: `ai-${randomUUID()}`, gender, entry: null, isAi: true };
  }

  private avgCrossScore(males: Slot[], females: Slot[]): number | null {
    let sum = 0;
    let n = 0;
    for (const m of males) {
      if (!m.entry) continue;
      for (const f of females) {
        if (!f.entry) continue;
        sum += preferenceScore(
          m.entry.preferenceSnapshot as PreferenceSignals,
          f.entry.preferenceSnapshot as PreferenceSignals,
        );
        n++;
      }
    }
    return n === 0 ? null : sum / n;
  }
}
