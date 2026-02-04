import type Database from "better-sqlite3";
import type { Party, PartyResults } from "@mingle/shared";

export class PartyRepo {
  constructor(private db: Database.Database) {}

  insert(party: Party): void {
    this.db
      .prepare(
        `INSERT INTO parties (id, name, scheduled_at, max_participants, theme, round_count,
          round_duration_minutes, status, results, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        party.id,
        party.name,
        party.scheduledAt,
        party.maxParticipants,
        party.theme ?? null,
        party.roundCount,
        party.roundDurationMinutes,
        party.status,
        party.results ? JSON.stringify(party.results) : null,
        party.createdAt,
        party.updatedAt
      );
  }

  findById(id: string): Party | null {
    const row = this.db.prepare("SELECT * FROM parties WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  addParticipant(partyId: string, profileId: string): void {
    this.db
      .prepare("INSERT OR IGNORE INTO party_participants (party_id, profile_id) VALUES (?, ?)")
      .run(partyId, profileId);
  }

  getParticipantIds(partyId: string): string[] {
    const rows = this.db
      .prepare("SELECT profile_id FROM party_participants WHERE party_id = ?")
      .all(partyId) as Array<{ profile_id: string }>;
    return rows.map((r) => r.profile_id);
  }

  getParticipantCount(partyId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM party_participants WHERE party_id = ?")
      .get(partyId) as { cnt: number };
    return row.cnt;
  }

  updateStatus(id: string, status: Party["status"]): void {
    this.db
      .prepare("UPDATE parties SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, id);
  }

  updateResults(id: string, results: PartyResults): void {
    this.db
      .prepare("UPDATE parties SET results = ?, status = 'completed', updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(results), id);
  }

  private mapRow(row: Record<string, unknown>): Party {
    return {
      id: row.id as string,
      name: row.name as string,
      scheduledAt: row.scheduled_at as string,
      maxParticipants: row.max_participants as number,
      theme: (row.theme as string) || undefined,
      roundCount: row.round_count as number,
      roundDurationMinutes: row.round_duration_minutes as number,
      status: row.status as Party["status"],
      results: row.results ? JSON.parse(row.results as string) : undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
