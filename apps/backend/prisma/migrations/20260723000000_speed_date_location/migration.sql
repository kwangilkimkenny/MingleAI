-- Distance-based blind speed-date matching (2026-07-23): optional per-entry geo on the queue.
-- The schema (SpeedDateQueueEntry) gained `lat`/`lng`/`radiusKm` but the location feature commit
-- shipped no migration, so a `migrate deploy`d DB lacks these columns while the generated Prisma
-- Client SELECTs them on every queue query — enqueue/sweep/status all throw "column does not exist".
-- This migration reconciles the drift. `IF NOT EXISTS` keeps it idempotent for DBs already patched
-- via `prisma db push`.

ALTER TABLE "speed_date_queue_entries"
  ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "radius_km" INTEGER;
