-- AlterTable
-- Backfilled implicitly by the column default, so existing users land on
-- English rather than NULL.
ALTER TABLE "users" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
