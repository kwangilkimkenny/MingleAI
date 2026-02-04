import type Database from "better-sqlite3";
import type { Report } from "@mingle/shared";

export class ReportRepo {
  constructor(private db: Database.Database) {}

  insert(report: Report): void {
    this.db
      .prepare(
        `INSERT INTO reports (id, party_id, profile_id, report_type, match_scores,
          highlights, recommendations, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        report.id,
        report.partyId,
        report.profileId,
        report.reportType,
        JSON.stringify(report.matchScores),
        JSON.stringify(report.highlights),
        JSON.stringify(report.recommendations),
        report.createdAt
      );
  }

  findById(id: string): Report | null {
    const row = this.db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  findByProfileId(profileId: string, limit = 10, offset = 0): Report[] {
    const rows = this.db
      .prepare("SELECT * FROM reports WHERE profile_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .all(profileId, limit, offset) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): Report {
    return {
      id: row.id as string,
      partyId: row.party_id as string,
      profileId: row.profile_id as string,
      reportType: row.report_type as Report["reportType"],
      matchScores: JSON.parse(row.match_scores as string),
      highlights: JSON.parse(row.highlights as string),
      recommendations: JSON.parse(row.recommendations as string),
      createdAt: row.created_at as string,
    };
  }
}
