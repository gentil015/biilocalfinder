-- Add Google authentication support
ALTER TABLE "users" ADD COLUMN "googleSub" TEXT;
ALTER TABLE "users" ADD COLUMN "googleEmail" TEXT;
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE UNIQUE INDEX "users_googleSub_key" ON "users"("googleSub");
CREATE INDEX "users_googleEmail_idx" ON "users"("googleEmail");
