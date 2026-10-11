-- Syncs workspaces whose type drifted from their provider's type.
--
-- Provider.providerType and Workspace.type are the same fact stored twice.
-- AuthService.register creates the workspace with a hardcoded INDIVIDUAL
-- (the real type isn't known until the onboarding type-selection step), and
-- selectProviderType only ever wrote the provider row -- so every provider who
-- completed onboarding as TEAM/BUSINESS/AGENCY kept an INDIVIDUAL workspace,
-- which is what the workspace switcher renders and what workspace-scoped plan
-- lookups read.
--
-- selectProviderType now writes both inside one transaction, so this is a
-- one-time repair of rows created before that fix. IS DISTINCT FROM is used
-- instead of != so a NULL comparison would still be caught.
--
-- Run once:
--
--   psql "$DATABASE_URL" -f prisma/manual-sql/012_sync_workspace_provider_type.sql

UPDATE "workspaces" w
SET "type" = p."providerType",
    "updatedAt" = now()
FROM "providers" p
WHERE p."workspaceId" = w."id"
  AND p."providerType" IS NOT NULL
  AND w."type" IS DISTINCT FROM p."providerType";