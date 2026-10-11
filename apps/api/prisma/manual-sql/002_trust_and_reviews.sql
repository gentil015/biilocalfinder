-- At most one PENDING verification per (provider, type, offering). Prisma
-- has no way to express a partial unique index, so it's added here — same
-- pattern as 001_add_postgis.sql for the geography columns.
--
-- COALESCE folds the nullable serviceOfferingId into the key so two
-- IDENTITY/BUSINESS submissions (both NULL) still collide, while different
-- SERVICE offerings don't collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS verification_records_one_pending_per_subject
  ON "verification_records" ("providerId", "type", COALESCE("serviceOfferingId", '00000000-0000-0000-0000-000000000000'))
  WHERE "status" = 'PENDING';

-- Reviews are read far more than written, and the provider profile page
-- always filters to PUBLISHED — this index is what
-- ReviewsService.findForProvider/summaryForProvider hit.
CREATE INDEX IF NOT EXISTS reviews_provider_published_created
  ON "reviews" ("providerId", "createdAt" DESC)
  WHERE "status" = 'PUBLISHED';
