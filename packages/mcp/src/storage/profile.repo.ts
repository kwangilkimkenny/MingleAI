import type Database from "better-sqlite3";
import type { Profile } from "@mingle/shared";

export class ProfileRepo {
  constructor(private db: Database.Database) {}

  insert(profile: Profile): void {
    this.db
      .prepare(
        `INSERT INTO profiles (id, user_id, name, age, gender, location, occupation,
          preferences, "values", communication_style, bio, agent_persona, risk_score, status,
          created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        profile.id,
        profile.userId,
        profile.name,
        profile.age,
        profile.gender,
        profile.location,
        profile.occupation ?? null,
        JSON.stringify(profile.preferences),
        JSON.stringify(profile.values),
        JSON.stringify(profile.communicationStyle),
        profile.bio ?? null,
        profile.agentPersona,
        profile.riskScore,
        profile.status,
        profile.createdAt,
        profile.updatedAt
      );
  }

  findById(id: string): Profile | null {
    const row = this.db.prepare("SELECT * FROM profiles WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  findByUserId(userId: string): Profile | null {
    const row = this.db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  findAll(filters?: { relationshipGoal?: string; location?: string; ageMin?: number; ageMax?: number }, limit = 20, offset = 0): Profile[] {
    let query = "SELECT * FROM profiles WHERE status = 'active'";
    const params: unknown[] = [];

    if (filters?.location) {
      query += " AND location LIKE ?";
      params.push(`%${filters.location}%`);
    }
    if (filters?.ageMin) {
      query += " AND age >= ?";
      params.push(filters.ageMin);
    }
    if (filters?.ageMax) {
      query += " AND age <= ?";
      params.push(filters.ageMax);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = this.db.prepare(query).all(...params) as Record<string, unknown>[];

    const profiles = rows.map((r) => this.mapRow(r));

    if (filters?.relationshipGoal) {
      return profiles.filter((p) => p.values.relationshipGoal === filters.relationshipGoal);
    }
    return profiles;
  }

  update(id: string, updates: Partial<Profile>): void {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.preferences !== undefined) {
      sets.push('preferences = ?');
      params.push(JSON.stringify(updates.preferences));
    }
    if (updates.values !== undefined) {
      sets.push('"values" = ?');
      params.push(JSON.stringify(updates.values));
    }
    if (updates.communicationStyle !== undefined) {
      sets.push("communication_style = ?");
      params.push(JSON.stringify(updates.communicationStyle));
    }
    if (updates.bio !== undefined) {
      sets.push("bio = ?");
      params.push(updates.bio);
    }
    if (updates.location !== undefined) {
      sets.push("location = ?");
      params.push(updates.location);
    }
    if (updates.agentPersona !== undefined) {
      sets.push("agent_persona = ?");
      params.push(updates.agentPersona);
    }
    if (updates.riskScore !== undefined) {
      sets.push("risk_score = ?");
      params.push(updates.riskScore);
    }
    if (updates.status !== undefined) {
      sets.push("status = ?");
      params.push(updates.status);
    }

    if (sets.length === 0) return;

    sets.push("updated_at = datetime('now')");
    params.push(id);

    this.db.prepare(`UPDATE profiles SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  }

  updateRiskScore(id: string, delta: number): void {
    this.db.prepare("UPDATE profiles SET risk_score = risk_score + ?, updated_at = datetime('now') WHERE id = ?").run(delta, id);
  }

  private mapRow(row: Record<string, unknown>): Profile {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      age: row.age as number,
      gender: row.gender as Profile["gender"],
      location: row.location as string,
      occupation: (row.occupation as string) || undefined,
      preferences: JSON.parse(row.preferences as string),
      values: JSON.parse(row.values as string),
      communicationStyle: JSON.parse(row.communication_style as string),
      bio: (row.bio as string) || undefined,
      agentPersona: row.agent_persona as string,
      riskScore: row.risk_score as number,
      status: row.status as Profile["status"],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
