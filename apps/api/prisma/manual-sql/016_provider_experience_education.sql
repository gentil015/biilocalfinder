-- 016: provider experience and education.
--
-- Additive only: two new provider-owned tables, each cascading on provider
-- deletion. Idempotent: re-running is a no-op. Matches the
-- ProviderExperience / ProviderEducation models in schema.prisma.

CREATE TABLE IF NOT EXISTS "provider_experiences" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerId"   text NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
  "title"        text NOT NULL,
  "organization" text NOT NULL,
  "location"     text,
  "startDate"    date NOT NULL,
  "endDate"      date,
  "isCurrent"    boolean NOT NULL DEFAULT false,
  "description"  text,
  "position"     integer NOT NULL DEFAULT 0,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "provider_experiences_providerId_idx"
  ON "provider_experiences" ("providerId");

CREATE TABLE IF NOT EXISTS "provider_educations" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerId"   text NOT NULL REFERENCES "providers"("id") ON DELETE CASCADE,
  "school"       text NOT NULL,
  "degree"       text,
  "fieldOfStudy" text,
  "startDate"    date,
  "endDate"      date,
  "description"  text,
  "position"     integer NOT NULL DEFAULT 0,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "provider_educations_providerId_idx"
  ON "provider_educations" ("providerId");
