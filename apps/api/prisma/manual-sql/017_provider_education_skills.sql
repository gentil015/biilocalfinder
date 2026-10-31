-- 017: degree-specific skills on provider education entries.
--
-- Additive only. Existing rows get an empty skills array, so the public
-- profile and editor keep rendering exactly as before until a provider
-- selects skills. Idempotent: re-running is a no-op.

ALTER TABLE "provider_educations"
  ADD COLUMN IF NOT EXISTS "skills" text[] NOT NULL DEFAULT '{}';
