-- Type-specific subscription plans + entitlement limits (Phase 4 of the
-- workspace-architecture project, spec §7). Run once, after 001-008.
--
-- What this does:
--   1. Adds subscription_plans."workspaceType" (backfilled to
--      'INDIVIDUAL' for the three plans seeded before this project —
--      FREE/PRO/BUSINESS — since those were written before type-specific
--      plans existed; existing ACTIVE subscriptions keep working
--      unchanged either way, since type-compatibility is enforced going
--      forward on new `subscribe()` calls only, never retroactively).
--   2. Adds "maxTeamMembers" and "maxManagedProviders".
--   3. Replaces the old global-unique constraint on `name` with
--      unique(workspaceType, name), since every type now gets its own
--      FREE/STANDARD/PRO.
--
-- Existing ProviderSubscription rows, and the providers/plans they
-- reference, are untouched — no subscriber loses access or data.

ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "workspaceType" "ProviderType";
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "maxTeamMembers" integer;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "maxManagedProviders" integer;

UPDATE "subscription_plans" SET "workspaceType" = 'INDIVIDUAL' WHERE "workspaceType" IS NULL;

ALTER TABLE "subscription_plans" ALTER COLUMN "workspaceType" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "subscription_plans" DROP CONSTRAINT IF EXISTS "subscription_plans_name_key";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "subscription_plans"
    ADD CONSTRAINT "subscription_plans_workspaceType_name_key" UNIQUE ("workspaceType", "name");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "subscription_plans_workspaceType_idx" ON "subscription_plans" ("workspaceType");
