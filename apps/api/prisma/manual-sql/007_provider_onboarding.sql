-- Provider Type Selection + onboarding progression. Mirrors 002-005: the
-- physical DDL for a schema.prisma change is hand-authored here rather
-- than via `prisma migrate dev` (this repo has no committed migrations
-- directory to diff against). Run after 001-006, once, in order.

-- Enums (Prisma maps `enum Foo { A B }` to a native Postgres enum type
-- named "Foo" by default — matching Prisma's own convention here since
-- there's no @@map on these).
DO $$ BEGIN
  CREATE TYPE "ProviderType" AS ENUM ('INDIVIDUAL', 'TEAM', 'BUSINESS', 'AGENCY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProviderOnboardingStep" AS ENUM
    ('TYPE_SELECTION', 'PROFILE_DETAILS', 'SERVICES_SETUP', 'VERIFICATION', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TeamMemberStatus" AS ENUM ('INVITED', 'ACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "providerType" "ProviderType";
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "onboardingStep" "ProviderOnboardingStep" NOT NULL DEFAULT 'TYPE_SELECTION';
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" timestamptz;
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "logoUrl" text;
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "registrationNumber" text;
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "representativeName" text;
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "teamSize" integer;

CREATE INDEX IF NOT EXISTS "providers_providerType_idx" ON "providers" ("providerType");
CREATE INDEX IF NOT EXISTS "providers_onboardingStep_idx" ON "providers" ("onboardingStep");

-- Backward compatibility (spec: "Existing providers must continue to
-- work... backward-compatible migration or default strategy for existing
-- records"). Every row that exists AT THE TIME THIS SCRIPT RUNS predates
-- this feature by definition, so it's a real, already-operating profile —
-- back-fill it as a completed INDIVIDUAL rather than leaving it stuck at
-- TYPE_SELECTION (which would make search's new completed-only filter,
-- below, wrongly hide it). Anything created after this script runs starts
-- fresh at TYPE_SELECTION via the column defaults above, and goes through
-- onboarding normally.
UPDATE "providers"
SET "providerType" = 'INDIVIDUAL',
    "onboardingStep" = 'COMPLETED',
    "onboardingCompletedAt" = COALESCE("onboardingCompletedAt", now())
WHERE "providerType" IS NULL;

CREATE TABLE IF NOT EXISTS "provider_team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerId" uuid NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
  "name" text,
  "email" text,
  "phone" text,
  "role" text,
  "linkedProviderId" uuid UNIQUE REFERENCES "providers"("id") ON DELETE SET NULL,
  "status" "TeamMemberStatus" NOT NULL DEFAULT 'INVITED',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "provider_team_members_providerId_idx" ON "provider_team_members" ("providerId");
