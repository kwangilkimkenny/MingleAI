-- Social-only auth + real-name identity verification + granular consent (2026-07-22).
-- email/password removed: email + password_hash become nullable; identity is (auth_provider, provider_id).

-- AlterTable: relax legacy email/password constraints
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- AlterTable: social provider + verified real-name identity
ALTER TABLE "users" ADD COLUMN "auth_provider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "users" ADD COLUMN "provider_id" TEXT;
ALTER TABLE "users" ADD COLUMN "phone_number" TEXT;
ALTER TABLE "users" ADD COLUMN "phone_verified_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "identity_ci" TEXT;
ALTER TABLE "users" ADD COLUMN "identity_di" TEXT;
ALTER TABLE "users" ADD COLUMN "verified_name" TEXT;
ALTER TABLE "users" ADD COLUMN "verified_birth" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "verified_gender" TEXT;

-- CreateTable
CREATE TABLE "consent_grants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_identity_ci_key" ON "users"("identity_ci");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_provider_provider_id_key" ON "users"("auth_provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "consent_grants_user_id_scope_key" ON "consent_grants"("user_id", "scope");

-- AddForeignKey
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
