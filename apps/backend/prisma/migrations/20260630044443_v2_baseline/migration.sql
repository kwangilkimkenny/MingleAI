-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
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
    "occupation" TEXT NOT NULL,
    "party_preference_text" TEXT NOT NULL,
    "preference_signals" JSONB,
    "photo_url" TEXT,
    "interests" JSONB,
    "bio" TEXT,
    "location" TEXT,
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
    "status" TEXT NOT NULL DEFAULT 'matching',
    "max_participants" INTEGER NOT NULL DEFAULT 8,
    "location" TEXT,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
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
CREATE TABLE "date_plans" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "constraints" JSONB NOT NULL,
    "courses" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "selected_course_id" TEXT,
    "merchant_pay_key" TEXT,
    "payment_id" TEXT,
    "payment_status" TEXT,
    "payment_amount" INTEGER,
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

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "matchmaking_queue_entries" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "preference_snapshot" JSONB NOT NULL,
    "matched_party_id" TEXT,
    "enqueued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matchmaking_queue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_messages" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "game_type" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "result" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "from_profile_id" TEXT NOT NULL,
    "to_profile_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "party_id" TEXT,
    "proposal_id" TEXT,
    "profile_id_1" TEXT NOT NULL,
    "profile_id_2" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_message_rooms" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_message_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_messages" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "sender_profile_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "blocker_profile_id" TEXT NOT NULL,
    "blocked_profile_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "parties_status_idx" ON "parties"("status");

-- CreateIndex
CREATE INDEX "party_participants_profile_id_idx" ON "party_participants"("profile_id");

-- CreateIndex
CREATE INDEX "date_plans_match_id_idx" ON "date_plans"("match_id");

-- CreateIndex
CREATE INDEX "safety_reports_status_created_at_idx" ON "safety_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "matchmaking_queue_entries_status_idx" ON "matchmaking_queue_entries"("status");

-- CreateIndex
CREATE INDEX "matchmaking_queue_entries_profile_id_idx" ON "matchmaking_queue_entries"("profile_id");

-- CreateIndex
CREATE INDEX "party_messages_party_id_created_at_idx" ON "party_messages"("party_id", "created_at");

-- CreateIndex
CREATE INDEX "game_sessions_party_id_idx" ON "game_sessions"("party_id");

-- CreateIndex
CREATE INDEX "proposals_to_profile_id_status_idx" ON "proposals"("to_profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_party_id_from_profile_id_to_profile_id_key" ON "proposals"("party_id", "from_profile_id", "to_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_proposal_id_key" ON "matches"("proposal_id");

-- CreateIndex
CREATE INDEX "matches_profile_id_1_idx" ON "matches"("profile_id_1");

-- CreateIndex
CREATE INDEX "matches_profile_id_2_idx" ON "matches"("profile_id_2");

-- CreateIndex
CREATE UNIQUE INDEX "matches_profile_id_1_profile_id_2_key" ON "matches"("profile_id_1", "profile_id_2");

-- CreateIndex
CREATE UNIQUE INDEX "direct_message_rooms_match_id_key" ON "direct_message_rooms"("match_id");

-- CreateIndex
CREATE INDEX "direct_messages_room_id_created_at_idx" ON "direct_messages"("room_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blocker_profile_id_blocked_profile_id_key" ON "blocks"("blocker_profile_id", "blocked_profile_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_participants" ADD CONSTRAINT "party_participants_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_participants" ADD CONSTRAINT "party_participants_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_plans" ADD CONSTRAINT "date_plans_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_reporter_profile_id_fkey" FOREIGN KEY ("reporter_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_reports" ADD CONSTRAINT "safety_reports_reported_profile_id_fkey" FOREIGN KEY ("reported_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchmaking_queue_entries" ADD CONSTRAINT "matchmaking_queue_entries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_messages" ADD CONSTRAINT "party_messages_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_messages" ADD CONSTRAINT "party_messages_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_from_profile_id_fkey" FOREIGN KEY ("from_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_to_profile_id_fkey" FOREIGN KEY ("to_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_profile_id_1_fkey" FOREIGN KEY ("profile_id_1") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_profile_id_2_fkey" FOREIGN KEY ("profile_id_2") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_message_rooms" ADD CONSTRAINT "direct_message_rooms_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "direct_message_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_profile_id_fkey" FOREIGN KEY ("sender_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_profile_id_fkey" FOREIGN KEY ("blocker_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_profile_id_fkey" FOREIGN KEY ("blocked_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
