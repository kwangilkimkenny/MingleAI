import type Database from "better-sqlite3";
import type { DatePlan } from "@mingle/shared";

export class DatePlanRepo {
  constructor(private db: Database.Database) {}

  insert(plan: DatePlan): void {
    this.db
      .prepare(
        `INSERT INTO date_plans (id, profile_id_1, profile_id_2, constraints, courses, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        plan.id,
        plan.profileId1,
        plan.profileId2,
        JSON.stringify(plan.constraints),
        JSON.stringify(plan.courses),
        plan.status,
        plan.createdAt
      );
  }

  findById(id: string): DatePlan | null {
    const row = this.db.prepare("SELECT * FROM date_plans WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  private mapRow(row: Record<string, unknown>): DatePlan {
    return {
      id: row.id as string,
      profileId1: row.profile_id_1 as string,
      profileId2: row.profile_id_2 as string,
      constraints: JSON.parse(row.constraints as string),
      courses: JSON.parse(row.courses as string),
      status: row.status as DatePlan["status"],
      createdAt: row.created_at as string,
    };
  }
}
