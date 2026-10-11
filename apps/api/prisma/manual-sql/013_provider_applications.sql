-- 013: "Become a provider" applications.
--
-- Additive only: a new enum, a new table and its indexes. Nothing existing is
-- altered or dropped, so this is safe to run against a live database.
--
-- Why this exists: /account's "Become a provider" link pointed at /register,
-- so an existing client trying to start trading created a SECOND user row with
-- a second login — leaving their requests, bookings, reviews and messages
-- behind on the client account. This table backs the alternative: the client
-- applies from their existing session, an admin reviews, and approval promotes
-- that same user to PROVIDER in place.
--
-- Column types deliberately match what `prisma migrate` would have emitted
-- (text ids with no default because @default(uuid()) is applied client-side,
-- `timestamp without time zone`, CURRENT_TIMESTAMP only on createdAt), so a
-- later `prisma migrate` sees no drift against this table.
--
-- Idempotent: re-running is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProviderApplicationStatus') THEN
    CREATE TYPE "ProviderApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "provider_applications" (
  "id"                 TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "providerType"       "ProviderType" NOT NULL,
  "businessName"       TEXT NOT NULL,
  "description"        TEXT,
  "phone"              TEXT,
  "yearsOfExperience"  INTEGER,
  "registrationNumber" TEXT,
  "idNumber"           TEXT,
  "websiteUrl"         TEXT,
  "categories"         TEXT[] NOT NULL DEFAULT '{}',
  "status"             "ProviderApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "decisionNote"       TEXT,
  "reviewedAt"         TIMESTAMP(3),
  "reviewedById"       TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "provider_applications_pkey" PRIMARY KEY ("id"),
  -- Cascade: deleting the user removes their application history with them,
  -- matching VerificationRecord.providerId rather than leaving orphan rows.
  CONSTRAINT "provider_applications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  -- SET NULL semantics: an admin account being removed should not delete the
  -- review record, just detach it from the reviewer who made the decision.
  CONSTRAINT "provider_applications_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "provider_applications_status_createdAt_idx"
  ON "provider_applications" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "provider_applications_userId_idx"
  ON "provider_applications" ("userId");

CREATE INDEX IF NOT EXISTS "provider_applications_reviewedById_idx"
  ON "provider_applications" ("reviewedById");

-- A client should never have two applications awaiting review at once.
-- Enforced here as well as in the service, so a double-submit from two tabs
-- cannot queue two reviews. Partial, so a rejected-then-reapplied history is
-- still allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "provider_applications_one_pending_per_user"
  ON "provider_applications" ("userId")
  WHERE "status" = 'PENDING';