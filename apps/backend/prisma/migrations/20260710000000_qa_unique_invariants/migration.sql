-- QA 2026-07-10: DB-level uniqueness invariants (defense in depth).
-- Partial (filtered) UNIQUE indexes cannot be expressed in Prisma PSL, so this migration is
-- hand-authored raw SQL. The application layer already enforces these invariants
-- (matchmaking enqueue: Serializable tx + P2002 handling; game start: per-party advisory lock);
-- these indexes make the invariants DB-guaranteed regardless of code path.

-- 1) matchmaking_queue_entries: at most one 'waiting' entry per profile.
--    Cancel any pre-existing duplicate waiting rows (keep the most recent) so the index can build.
UPDATE "matchmaking_queue_entries" q
SET "status" = 'cancelled', "updated_at" = now()
WHERE "status" = 'waiting'
  AND "id" <> (
    SELECT q2."id"
    FROM "matchmaking_queue_entries" q2
    WHERE q2."profile_id" = q."profile_id" AND q2."status" = 'waiting'
    ORDER BY q2."enqueued_at" DESC, q2."id" DESC
    LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS "matchmaking_queue_entries_profile_waiting_key"
  ON "matchmaking_queue_entries" ("profile_id")
  WHERE "status" = 'waiting';

-- 2) game_sessions: at most one 'active' session per party.
--    End any pre-existing duplicate active sessions (keep the most recent) so the index can build.
UPDATE "game_sessions" g
SET "status" = 'ended', "ended_at" = now()
WHERE "status" = 'active'
  AND "id" <> (
    SELECT g2."id"
    FROM "game_sessions" g2
    WHERE g2."party_id" = g."party_id" AND g2."status" = 'active'
    ORDER BY g2."started_at" DESC, g2."id" DESC
    LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS "game_sessions_party_active_key"
  ON "game_sessions" ("party_id")
  WHERE "status" = 'active';
