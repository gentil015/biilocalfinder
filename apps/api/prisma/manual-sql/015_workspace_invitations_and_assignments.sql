-- 015: email-only workspace invitations and request/booking assignment.
--
-- Additive only. Existing memberships and provider-scoped records keep
-- working unchanged; these columns are nullable and default to unassigned.
-- Idempotent: re-running is a no-op.

CREATE TABLE IF NOT EXISTS "workspace_invitations" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "email"       text NOT NULL,
  "role"        "WorkspaceMemberRole" NOT NULL,
  "tokenHash"   text NOT NULL UNIQUE,
  "invitedById" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expiresAt"   timestamptz NOT NULL,
  "acceptedAt"  timestamptz,
  "revokedAt"   timestamptz,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "workspace_invitations_workspaceId_email_idx"
  ON "workspace_invitations" ("workspaceId", "email");
CREATE INDEX IF NOT EXISTS "workspace_invitations_email_idx"
  ON "workspace_invitations" ("email");

ALTER TABLE "service_requests"
  ADD COLUMN IF NOT EXISTS "assignedMembershipId" uuid REFERENCES "workspace_memberships"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "assignedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "assignedById" uuid;

CREATE INDEX IF NOT EXISTS "service_requests_assignedMembershipId_idx"
  ON "service_requests" ("assignedMembershipId");

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "assignedMembershipId" uuid REFERENCES "workspace_memberships"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "assignedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "assignedById" uuid;

CREATE INDEX IF NOT EXISTS "bookings_assignedMembershipId_idx"
  ON "bookings" ("assignedMembershipId");
