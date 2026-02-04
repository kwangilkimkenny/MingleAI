import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function initDatabase(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? join(__dirname, "..", "..", "data", "mingle.db");

  mkdirSync(dirname(resolvedPath), { recursive: true });

  const db = new Database(resolvedPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  createTables(db);

  return db;
}

function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      location TEXT NOT NULL,
      occupation TEXT,
      preferences TEXT NOT NULL,
      "values" TEXT NOT NULL,
      communication_style TEXT NOT NULL,
      bio TEXT,
      agent_persona TEXT NOT NULL,
      risk_score REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parties (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      max_participants INTEGER DEFAULT 20,
      theme TEXT,
      round_count INTEGER DEFAULT 3,
      round_duration_minutes INTEGER DEFAULT 10,
      status TEXT DEFAULT 'scheduled',
      results TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS party_participants (
      party_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (party_id, profile_id),
      FOREIGN KEY (party_id) REFERENCES parties(id),
      FOREIGN KEY (profile_id) REFERENCES profiles(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      party_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      match_scores TEXT NOT NULL,
      highlights TEXT NOT NULL,
      recommendations TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (party_id) REFERENCES parties(id),
      FOREIGN KEY (profile_id) REFERENCES profiles(id)
    );

    CREATE TABLE IF NOT EXISTS date_plans (
      id TEXT PRIMARY KEY,
      profile_id_1 TEXT NOT NULL,
      profile_id_2 TEXT NOT NULL,
      constraints TEXT NOT NULL,
      courses TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (profile_id_1) REFERENCES profiles(id),
      FOREIGN KEY (profile_id_2) REFERENCES profiles(id)
    );

    CREATE TABLE IF NOT EXISTS safety_reports (
      id TEXT PRIMARY KEY,
      reporter_profile_id TEXT NOT NULL,
      reported_profile_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      evidence_party_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (reporter_profile_id) REFERENCES profiles(id),
      FOREIGN KEY (reported_profile_id) REFERENCES profiles(id)
    );
  `);
}
