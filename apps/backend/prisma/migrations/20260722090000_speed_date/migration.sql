-- Blind Speed Date (2026-07-22): gender-aware matching queue + timed multi-phase session.
-- Partial (filtered) UNIQUE index cannot be expressed in Prisma PSL, so this migration is
-- hand-authored raw SQL (mirrors 20260710000000_qa_unique_invariants). The application layer
-- enforces the invariants (enqueue: Serializable tx + P2002; session start: profile active check);
-- the partial index makes "one waiting entry per profile" DB-guaranteed.

-- CreateTable
CREATE TABLE "speed_date_queue_entries" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "preference_snapshot" JSONB NOT NULL,
    "matched_session_id" TEXT,
    "enqueued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speed_date_queue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speed_date_sessions" (
    "id" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "result" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "speed_date_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "speed_date_queue_entries_status_idx" ON "speed_date_queue_entries"("status");

-- CreateIndex
CREATE INDEX "speed_date_queue_entries_profile_id_idx" ON "speed_date_queue_entries"("profile_id");

-- CreateIndex
CREATE INDEX "speed_date_sessions_status_idx" ON "speed_date_sessions"("status");

-- AddForeignKey
ALTER TABLE "speed_date_queue_entries" ADD CONSTRAINT "speed_date_queue_entries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial UNIQUE index: at most one 'waiting' speed-date entry per profile (defense in depth).
CREATE UNIQUE INDEX IF NOT EXISTS "speed_date_queue_entries_profile_waiting_key"
  ON "speed_date_queue_entries" ("profile_id")
  WHERE "status" = 'waiting';
