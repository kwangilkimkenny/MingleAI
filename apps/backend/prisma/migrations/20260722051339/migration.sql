/*
  Warnings:

  - You are about to drop the column `merchant_pay_key` on the `date_plans` table. All the data in the column will be lost.
  - You are about to drop the column `payment_amount` on the `date_plans` table. All the data in the column will be lost.
  - You are about to drop the column `payment_id` on the `date_plans` table. All the data in the column will be lost.
  - You are about to drop the column `payment_status` on the `date_plans` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "date_plans" DROP COLUMN "merchant_pay_key",
DROP COLUMN "payment_amount",
DROP COLUMN "payment_id",
DROP COLUMN "payment_status";

-- RenameIndex
ALTER INDEX "safety_risk_contributions_reporter_profile_id_reported_profile_" RENAME TO "safety_risk_contributions_reporter_profile_id_reported_prof_key";
