-- Production security hardening: refresh-token rotation and race-free report scoring.

ALTER TABLE "users"
ADD COLUMN "terms_accepted_at" TIMESTAMP(3),
ADD COLUMN "terms_version" TEXT,
ADD COLUMN "privacy_version" TEXT;

ALTER TABLE "date_plans" ADD COLUMN "completed_at" TIMESTAMP(3);

CREATE TABLE "refresh_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "safety_risk_contributions" (
  "id" TEXT NOT NULL,
  "reporter_profile_id" TEXT NOT NULL,
  "reported_profile_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "safety_risk_contributions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "safety_risk_contributions_reporter_profile_id_reported_profile_id_key"
  ON "safety_risk_contributions"("reporter_profile_id", "reported_profile_id");
CREATE INDEX "safety_risk_contributions_reported_profile_id_idx"
  ON "safety_risk_contributions"("reported_profile_id");
ALTER TABLE "safety_risk_contributions"
  ADD CONSTRAINT "safety_risk_contributions_reporter_profile_id_fkey"
  FOREIGN KEY ("reporter_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "safety_risk_contributions"
  ADD CONSTRAINT "safety_risk_contributions_reported_profile_id_fkey"
  FOREIGN KEY ("reported_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the already-earned one-contribution-per-pair invariant for existing reports.
INSERT INTO "safety_risk_contributions" ("id", "reporter_profile_id", "reported_profile_id", "created_at")
SELECT gen_random_uuid()::text, "reporter_profile_id", "reported_profile_id", MIN("created_at")
FROM "safety_reports"
GROUP BY "reporter_profile_id", "reported_profile_id"
ON CONFLICT ("reporter_profile_id", "reported_profile_id") DO NOTHING;
