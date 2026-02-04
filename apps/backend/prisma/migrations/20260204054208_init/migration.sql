-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "occupation" TEXT,
    "preferences" JSONB NOT NULL,
    "values" JSONB NOT NULL,
    "communication_style" JSONB NOT NULL,
    "bio" TEXT,
    "agent_persona" TEXT NOT NULL DEFAULT '',
    "risk_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "max_participants" INTEGER NOT NULL DEFAULT 20,
    "theme" TEXT,
    "round_count" INTEGER NOT NULL DEFAULT 3,
    "round_duration_minutes" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "results" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_participants" (
    "party_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_participants_pkey" PRIMARY KEY ("party_id","profile_id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "match_scores" JSONB NOT NULL,
    "highlights" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "date_plans" (
    "id" TEXT NOT NULL,
    "profile_id_1" TEXT NOT NULL,
    "profile_id_2" TEXT NOT NULL,
    "constraints" JSONB NOT NULL,
    "courses" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "date_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_reports" (
    "id" TEXT NOT NULL,
    "reporter_profile_id" TEXT NOT NULL,
    "reported_profile_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "evidence_party_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_participants" ADD CONSTRAINT "party_participants_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_participants" ADD CONSTRAINT "party_participants_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_plans" ADD CONSTRAINT "date_plans_profile_id_1_fkey" FOREIGN KEY ("profile_id_1") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_plans" ADD CONSTRAINT "date_plans_profile_id_2_fkey" FOREIGN KEY ("profile_id_2") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_reporter_profile_id_fkey" FOREIGN KEY ("reporter_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_reported_profile_id_fkey" FOREIGN KEY ("reported_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
