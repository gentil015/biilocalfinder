-- Multi-provider workspace layer (Phase 2 of the workspace-architecture
-- project). Mirrors 007: hand-authored DDL, since this repo has no
-- committed migrations directory to diff against. Run after 001-007,
-- once, in order.
--
-- What this does:
--   1. Creates "workspaces" and "workspace_memberships".
--   2. Adds providers."workspaceId" (nullable at first, backfilled below,
--      then made NOT NULL + UNIQUE).
--   3. For every existing provider: creates one Workspace (copying its
--      type/name/onboarding state) and one OWNER WorkspaceMembership for
--      the provider's user, then links providers."workspaceId" to it.
--
-- This is purely additive: providers.userId keeps its existing UNIQUE
-- constraint, so no existing query or record changes behavior. See the
-- Workspace model's doc comment in schema.prisma for what this phase
-- does and does not yet enable.

DO $$ BEGIN
  CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkspaceMemberRole" AS ENUM ('OWNER', 'MANAGER', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkspaceMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                  text NOT NULL,
  "slug"                  text NOT NULL UNIQUE,
  "type"                  "ProviderType" NOT NULL,
  "ownerId"               uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status"                "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
  "onboardingStep"        "ProviderOnboardingStep" NOT NULL DEFAULT 'TYPE_SELECTION',
  "onboardingCompletedAt" timestamptz,
  "createdAt"             timestamptz NOT NULL DEFAULT now(),
  "updatedAt"             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "workspaces_ownerId_idx" ON "workspaces" ("ownerId");
CREATE INDEX IF NOT EXISTS "workspaces_type_idx" ON "workspaces" ("type");
CREATE INDEX IF NOT EXISTS "workspaces_status_idx" ON "workspaces" ("status");

CREATE TABLE IF NOT EXISTS "workspace_memberships" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId"  uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "userId"       uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"         "WorkspaceMemberRole" NOT NULL DEFAULT 'MEMBER',
  "status"       "WorkspaceMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "invitedEmail" text,
  "invitedAt"    timestamptz,
  "joinedAt"     timestamptz,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("workspaceId", "userId")
);

CREATE INDEX IF NOT EXISTS "workspace_memberships_workspaceId_idx" ON "workspace_memberships" ("workspaceId");
CREATE INDEX IF NOT EXISTS "workspace_memberships_userId_idx" ON "workspace_memberships" ("userId");

ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "workspaceId" uuid REFERENCES "workspaces"("id");

-- Backfill: one Workspace + one OWNER membership per existing provider.
-- Slugs are derived from businessName, de-duplicated with a numeric
-- suffix on collision (two providers can share a business name).
DO $$
DECLARE
  r RECORD;
  new_ws_id uuid;
  base_slug text;
  final_slug text;
  suffix int;
BEGIN
  FOR r IN SELECT * FROM "providers" WHERE "workspaceId" IS NULL LOOP
    base_slug := lower(regexp_replace(coalesce(r."businessName", 'workspace'), '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN
      base_slug := 'workspace';
    END IF;

    final_slug := base_slug;
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM "workspaces" WHERE "slug" = final_slug) LOOP
      suffix := suffix + 1;
      final_slug := base_slug || '-' || suffix;
    END LOOP;

    INSERT INTO "workspaces"
      ("name", "slug", "type", "ownerId", "status", "onboardingStep", "onboardingCompletedAt")
    VALUES
      (r."businessName", final_slug, coalesce(r."providerType", 'INDIVIDUAL'), r."userId",
       'ACTIVE', r."onboardingStep", r."onboardingCompletedAt")
    RETURNING "id" INTO new_ws_id;

    UPDATE "providers" SET "workspaceId" = new_ws_id WHERE "id" = r."id";

    INSERT INTO "workspace_memberships" ("workspaceId", "userId", "role", "status", "joinedAt")
    VALUES (new_ws_id, r."userId", 'OWNER', 'ACTIVE', now());
  END LOOP;
END $$;

-- Every provider now has a workspace — safe to enforce NOT NULL + UNIQUE.
ALTER TABLE "providers" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "providers" ADD CONSTRAINT "providers_workspaceId_key" UNIQUE ("workspaceId");
