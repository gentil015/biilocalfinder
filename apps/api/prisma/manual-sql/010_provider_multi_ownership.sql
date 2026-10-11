-- Drops Provider.userId's uniqueness constraint (Phase "ownership" of the
-- workspace-architecture project). Run once, after 001-009.
--
-- Provider.workspaceId (unique since 008) becomes the sole 1:1 identity
-- key; Provider.userId is now an ordinary (indexed) foreign key, so one
-- user can own more than one Provider/Workspace — e.g. an individual
-- plumber's workspace and a separate cleaning-business workspace.
--
-- This alone does not change any existing row or any existing account's
-- behavior: every account today still has at most one Provider, so every
-- `findUnique`-by-userId lookup that this enables replacing keeps
-- returning exactly what it always did for them. See
-- ProviderContextService (apps/api/src/providers/provider-context.service.ts)
-- for how "the provider acting on behalf of this user" is resolved now
-- that the lookup is no longer unconditionally unambiguous, and
-- docs/WORKSPACES.md for which endpoints are (and aren't yet) aware of a
-- specific workspace when a user has more than one.

DO $$ BEGIN
  ALTER TABLE "providers" DROP CONSTRAINT IF EXISTS "providers_userId_key";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "providers_userId_idx" ON "providers" ("userId");
